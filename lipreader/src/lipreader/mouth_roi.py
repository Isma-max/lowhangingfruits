"""Per-frame mouth region-of-interest extraction using MediaPipe FaceLandmarker.

MediaPipe's 478-point face mesh assigns fixed indices to lip contour points
regardless of image content; this is the standard canonical set used to
bound the mouth region (outer + inner lip ring).
"""

from __future__ import annotations

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

_ASSET_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
DEFAULT_MODEL_PATH = _ASSET_DIR / "face_landmarker.task"

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


class MouthRoiExtractor:
    def __init__(self, model_path: Path = DEFAULT_MODEL_PATH, roi_size: int = 96, margin: float = 0.35):
        if not Path(model_path).is_file():
            raise FileNotFoundError(
                f"FaceLandmarker model not found at {model_path}. "
                "Expected it bundled under lipreader/assets/."
            )
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=RunningMode.VIDEO,
            num_faces=1,
        )
        self._landmarker = FaceLandmarker.create_from_options(options)
        self.roi_size = roi_size
        self.margin = margin

    def close(self) -> None:
        self._landmarker.close()

    def __enter__(self) -> "MouthRoiExtractor":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _mouth_bbox(self, landmarks, width: int, height: int) -> tuple[int, int, int, int]:
        xs = [landmarks[i].x for i in LIP_LANDMARK_INDICES]
        ys = [landmarks[i].y for i in LIP_LANDMARK_INDICES]
        x_min, x_max = min(xs) * width, max(xs) * width
        y_min, y_max = min(ys) * height, max(ys) * height

        w, h = x_max - x_min, y_max - y_min
        cx, cy = (x_min + x_max) / 2, (y_min + y_max) / 2
        side = max(w, h) * (1.0 + self.margin)

        x0 = int(max(cx - side / 2, 0))
        y0 = int(max(cy - side / 2, 0))
        x1 = int(min(cx + side / 2, width))
        y1 = int(min(cy + side / 2, height))
        return x0, y0, x1, y1

    def extract(self, frame_bgr: np.ndarray, timestamp_ms: int) -> np.ndarray | None:
        """Return a (roi_size, roi_size) grayscale mouth crop, or None if no face found."""
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)
        if not result.face_landmarks:
            return None

        landmarks = result.face_landmarks[0]
        height, width = frame_bgr.shape[:2]
        x0, y0, x1, y1 = self._mouth_bbox(landmarks, width, height)
        if x1 <= x0 or y1 <= y0:
            return None

        crop = frame_bgr[y0:y1, x0:x1]
        crop = cv2.resize(crop, (self.roi_size, self.roi_size), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        return gray


def extract_mouth_sequence(
    frames: list[np.ndarray],
    fps: float,
    model_path: Path = DEFAULT_MODEL_PATH,
    roi_size: int = 96,
) -> np.ndarray:
    """Run mouth ROI extraction over a list of frames.

    Frames where no face is detected are dropped (VOD footage is assumed to
    keep the speaker's face on screen for the whole segment being analyzed).
    Returns an array of shape (T, roi_size, roi_size), dtype uint8.
    """
    ms_per_frame = 1000.0 / fps if fps > 0 else 40.0
    rois = []
    with MouthRoiExtractor(model_path=model_path, roi_size=roi_size) as extractor:
        for i, frame in enumerate(frames):
            roi = extractor.extract(frame, timestamp_ms=int(i * ms_per_frame))
            if roi is not None:
                rois.append(roi)
    if not rois:
        raise RuntimeError("No face/mouth detected in any frame of the input video.")
    return np.stack(rois, axis=0)
