"""Shared per-frame face landmark detection (single- or multi-face)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    FaceLandmarker,
    FaceLandmarkerOptions,
    RunningMode,
)

ASSET_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
DEFAULT_MODEL_PATH = ASSET_DIR / "face_landmarker.task"


@dataclass
class DetectedFace:
    landmarks_xy: list[tuple[float, float]]  # normalized (x, y) per landmark, in model order
    bbox: tuple[int, int, int, int]  # pixel (x0, y0, x1, y1), full-face extent


def _bbox_from_landmarks(landmarks_xy, width: int, height: int) -> tuple[int, int, int, int]:
    xs = [p[0] for p in landmarks_xy]
    ys = [p[1] for p in landmarks_xy]
    x0 = int(max(min(xs) * width, 0))
    y0 = int(max(min(ys) * height, 0))
    x1 = int(min(max(xs) * width, width))
    y1 = int(min(max(ys) * height, height))
    return x0, y0, x1, y1


class FaceDetector:
    def __init__(self, max_faces: int = 1, model_path: Path = DEFAULT_MODEL_PATH):
        if not Path(model_path).is_file():
            raise FileNotFoundError(f"FaceLandmarker model not found at {model_path}")
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=RunningMode.VIDEO,
            num_faces=max_faces,
        )
        self._landmarker = FaceLandmarker.create_from_options(options)

    def close(self) -> None:
        self._landmarker.close()

    def __enter__(self) -> "FaceDetector":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[DetectedFace]:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)

        height, width = frame_bgr.shape[:2]
        faces = []
        for face_landmarks in result.face_landmarks:
            landmarks_xy = [(lm.x, lm.y) for lm in face_landmarks]
            bbox = _bbox_from_landmarks(landmarks_xy, width, height)
            faces.append(DetectedFace(landmarks_xy=landmarks_xy, bbox=bbox))
        return faces


def detect_faces_in_frames(
    frames: list[np.ndarray],
    fps: float,
    max_faces: int = 1,
    model_path: Path = DEFAULT_MODEL_PATH,
) -> list[list[DetectedFace]]:
    """Returns, for each input frame, the list of faces detected in it."""
    ms_per_frame = 1000.0 / fps if fps > 0 else 40.0
    per_frame: list[list[DetectedFace]] = []
    with FaceDetector(max_faces=max_faces, model_path=model_path) as detector:
        for i, frame in enumerate(frames):
            per_frame.append(detector.detect(frame, timestamp_ms=int(i * ms_per_frame)))
    return per_frame
