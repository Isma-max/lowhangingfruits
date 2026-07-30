"""Mouth region-of-interest cropping from already-detected face landmarks.

MediaPipe's 478-point face mesh assigns fixed indices to lip contour points
regardless of image content; this is the standard canonical set used to
bound the mouth region (outer + inner lip ring).
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from .detect import DEFAULT_MODEL_PATH, DetectedFace, detect_faces_in_frames

LIP_LANDMARK_INDICES = sorted(
    {
        # outer lip ring
        61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
        409, 270, 269, 267, 0, 37, 39, 40, 185,
        # inner lip ring
        78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
        415, 310, 311, 312, 13, 82, 81, 80, 191,
    }
)


def crop_mouth(
    frame_bgr: np.ndarray,
    landmarks_xy: list[tuple[float, float]],
    roi_size: int = 96,
    margin: float = 0.35,
) -> np.ndarray | None:
    """Crop+resize a grayscale mouth ROI given a frame and its face landmarks."""
    height, width = frame_bgr.shape[:2]
    xs = [landmarks_xy[i][0] for i in LIP_LANDMARK_INDICES]
    ys = [landmarks_xy[i][1] for i in LIP_LANDMARK_INDICES]
    x_min, x_max = min(xs) * width, max(xs) * width
    y_min, y_max = min(ys) * height, max(ys) * height

    w, h = x_max - x_min, y_max - y_min
    cx, cy = (x_min + x_max) / 2, (y_min + y_max) / 2
    side = max(w, h) * (1.0 + margin)

    x0 = int(max(cx - side / 2, 0))
    y0 = int(max(cy - side / 2, 0))
    x1 = int(min(cx + side / 2, width))
    y1 = int(min(cy + side / 2, height))
    if x1 <= x0 or y1 <= y0:
        return None

    crop = frame_bgr[y0:y1, x0:x1]
    crop = cv2.resize(crop, (roi_size, roi_size), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)


def extract_mouth_sequence(
    frames: list[np.ndarray],
    fps: float,
    model_path: Path = DEFAULT_MODEL_PATH,
    roi_size: int = 96,
) -> np.ndarray:
    """Single-speaker convenience path: detect the (one) face per frame and crop its mouth.

    Frames where no face is detected are dropped. Returns shape (T, roi_size, roi_size), uint8.
    For multi-speaker VOD, use `detect.detect_faces_in_frames` + `face_cluster` + `crop_mouth`
    instead (see transcribe.transcribe_characters).
    """
    per_frame_faces = detect_faces_in_frames(frames, fps=fps, max_faces=1, model_path=model_path)
    rois = []
    for frame, faces in zip(frames, per_frame_faces):
        if not faces:
            continue
        roi = crop_mouth(frame, faces[0].landmarks_xy, roi_size=roi_size)
        if roi is not None:
            rois.append(roi)
    if not rois:
        raise RuntimeError("No face/mouth detected in any frame of the input video.")
    return np.stack(rois, axis=0)
