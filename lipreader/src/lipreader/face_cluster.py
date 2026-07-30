"""Group the distinct faces detected across a video into "characters".

No identity recognition — this only tells apart "Character 1" vs "Character 2"
by visual similarity, so each can be assigned a language in the UI. Uses
MediaPipe's generic ImageEmbedder (MobileNetV3) on face crops + greedy
cosine-similarity clustering.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import ImageEmbedder, ImageEmbedderOptions

from .detect import DetectedFace

ASSET_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
DEFAULT_EMBEDDER_MODEL_PATH = ASSET_DIR / "image_embedder.tflite"

DEFAULT_SIMILARITY_THRESHOLD = 0.6
MIN_FACE_AREA_FRACTION = 0.01  # ignore tiny/spurious detections


@dataclass
class Character:
    id: str
    thumbnail: np.ndarray  # BGR crop, best (largest) seen


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


class _ClusterState:
    def __init__(self):
        self.centroids: list[np.ndarray] = []
        self.counts: list[int] = []
        self.thumbnails: list[np.ndarray] = []
        self.thumbnail_areas: list[float] = []

    def assign(self, embedding: np.ndarray, crop: np.ndarray, area: float, threshold: float) -> int:
        best_idx, best_sim = -1, -1.0
        for i, centroid in enumerate(self.centroids):
            sim = _cosine_similarity(embedding, centroid)
            if sim > best_sim:
                best_idx, best_sim = i, sim

        if best_idx >= 0 and best_sim >= threshold:
            n = self.counts[best_idx]
            self.centroids[best_idx] = (self.centroids[best_idx] * n + embedding) / (n + 1)
            self.counts[best_idx] += 1
            if area > self.thumbnail_areas[best_idx]:
                self.thumbnails[best_idx] = crop
                self.thumbnail_areas[best_idx] = area
            return best_idx

        self.centroids.append(embedding)
        self.counts.append(1)
        self.thumbnails.append(crop)
        self.thumbnail_areas.append(area)
        return len(self.centroids) - 1


def cluster_characters(
    frames: list[np.ndarray],
    per_frame_faces: list[list[DetectedFace]],
    embedder_model_path: Path = DEFAULT_EMBEDDER_MODEL_PATH,
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
) -> tuple[dict[str, Character], list[list[tuple[str, DetectedFace]]]]:
    """Returns (characters keyed by id, per-frame list of (character_id, DetectedFace))."""
    if not Path(embedder_model_path).is_file():
        raise FileNotFoundError(f"Image embedder model not found at {embedder_model_path}")

    options = ImageEmbedderOptions(base_options=BaseOptions(model_asset_path=str(embedder_model_path)))
    state = _ClusterState()
    assignments: list[list[tuple[int, DetectedFace]]] = []

    with ImageEmbedder.create_from_options(options) as embedder:
        for frame, faces in zip(frames, per_frame_faces):
            height, width = frame.shape[:2]
            frame_assignments = []
            for face in faces:
                x0, y0, x1, y1 = face.bbox
                area_frac = ((x1 - x0) * (y1 - y0)) / float(width * height)
                if area_frac < MIN_FACE_AREA_FRACTION:
                    continue
                crop = frame[y0:y1, x0:x1]
                if crop.size == 0:
                    continue

                rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = embedder.embed(mp_image)
                embedding = np.array(result.embeddings[0].embedding, dtype=np.float32)

                cluster_idx = state.assign(embedding, crop, area_frac, similarity_threshold)
                frame_assignments.append((cluster_idx, face))
            assignments.append(frame_assignments)

    # order character ids by total appearance count, most frequent first
    order = sorted(range(len(state.counts)), key=lambda i: state.counts[i], reverse=True)
    idx_to_id = {old_idx: f"character_{rank + 1}" for rank, old_idx in enumerate(order)}

    characters = {
        idx_to_id[i]: Character(id=idx_to_id[i], thumbnail=state.thumbnails[i])
        for i in range(len(state.centroids))
    }
    named_assignments = [
        [(idx_to_id[idx], face) for idx, face in frame_assignments]
        for frame_assignments in assignments
    ]
    return characters, named_assignments
