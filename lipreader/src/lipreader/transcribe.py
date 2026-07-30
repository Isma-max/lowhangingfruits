"""End-to-end orchestration: VOD source -> mouth ROI sequence(s) -> model -> ranked text candidates."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from . import face_cluster, mouth_roi, video_source
from .decode import Candidate, ctc_beam_search
from .detect import DetectedFace, detect_faces_in_frames
from .face_cluster import Character
from .model import build_model, load_pretrained
from .vocab import Vocab

TARGET_FPS = 25.0
ROI_SIZE = 96


def _run_model(mouth_seq: np.ndarray, language: str, top_k: int, checkpoint_path: Path | None) -> list[Candidate]:
    vocab = Vocab(language)
    model = build_model(vocab_size=len(vocab), roi_size=ROI_SIZE)
    load_pretrained(model, checkpoint_path)
    model.eval()

    tensor = torch.from_numpy(mouth_seq).float().unsqueeze(0) / 255.0  # (1, T, H, W)
    with torch.no_grad():
        log_probs = model(tensor)[0].numpy()  # (T, V)
    return ctc_beam_search(log_probs, vocab, top_k=top_k)


def transcribe(
    source: str,
    language: str,
    top_k: int = 3,
    checkpoint_path: Path | None = None,
    cache_dir: Path | None = None,
) -> list[Candidate]:
    """Single-speaker path: one language for the whole video (see transcribe_characters
    for multi-speaker VOD where each person on screen gets their own language)."""
    local_path = video_source.resolve_to_local_file(source, cache_dir=cache_dir)
    frames = video_source.extract_frames(local_path, target_fps=TARGET_FPS)
    if not frames:
        raise RuntimeError(f"No frames decoded from {source}")

    mouth_seq = mouth_roi.extract_mouth_sequence(frames, fps=TARGET_FPS, roi_size=ROI_SIZE)
    return _run_model(mouth_seq, language, top_k, checkpoint_path)


@dataclass
class DiscoveryResult:
    frames: list[np.ndarray]
    fps: float
    characters: dict[str, Character]
    assignments: list[list[tuple[str, DetectedFace]]]


def discover_characters(
    source: str,
    max_faces: int = 5,
    cache_dir: Path | None = None,
) -> DiscoveryResult:
    """Step 1 of the UI flow: find the distinct faces ("characters") in a VOD so the
    caller can assign each one a language before transcribing."""
    local_path = video_source.resolve_to_local_file(source, cache_dir=cache_dir)
    frames = video_source.extract_frames(local_path, target_fps=TARGET_FPS)
    if not frames:
        raise RuntimeError(f"No frames decoded from {source}")

    per_frame_faces = detect_faces_in_frames(frames, fps=TARGET_FPS, max_faces=max_faces)
    characters, assignments = face_cluster.cluster_characters(frames, per_frame_faces)
    if not characters:
        raise RuntimeError("No faces detected in the video.")
    return DiscoveryResult(frames=frames, fps=TARGET_FPS, characters=characters, assignments=assignments)


def transcribe_characters(
    discovery: DiscoveryResult,
    character_languages: dict[str, str],
    top_k: int = 3,
    checkpoint_path: Path | None = None,
) -> dict[str, list[Candidate]]:
    """Step 2 of the UI flow: for each character with an assigned language, gather that
    character's own mouth-crop sequence (from the frames where they appear) and transcribe
    it independently, using their assigned language's vocabulary."""
    results: dict[str, list[Candidate]] = {}
    for character_id, language in character_languages.items():
        rois = []
        for frame, frame_assignments in zip(discovery.frames, discovery.assignments):
            match = next((face for cid, face in frame_assignments if cid == character_id), None)
            if match is None:
                continue
            roi = mouth_roi.crop_mouth(frame, match.landmarks_xy, roi_size=ROI_SIZE)
            if roi is not None:
                rois.append(roi)

        if not rois:
            continue
        mouth_seq = np.stack(rois, axis=0)
        results[character_id] = _run_model(mouth_seq, language, top_k, checkpoint_path)
    return results
