"""VOD input handling: resolve a local path or URL to frames.

Audio is never touched here or anywhere downstream — the pipeline is
visual-only by design, so any audio track on the source video is simply
ignored.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from urllib.parse import urlparse

import cv2
import numpy as np


def is_url(source: str) -> bool:
    return urlparse(source).scheme in ("http", "https")


def resolve_to_local_file(source: str, cache_dir: Path | None = None) -> Path:
    """Return a local video file path, downloading it first if `source` is a URL."""
    if not is_url(source):
        path = Path(source)
        if not path.is_file():
            raise FileNotFoundError(f"No such video file: {source}")
        return path

    import yt_dlp

    cache_dir = cache_dir or Path(tempfile.mkdtemp(prefix="lipreader_"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(cache_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "outtmpl": out_template,
        "format": "bestvideo/best",
        "quiet": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(source, download=True)
        filename = ydl.prepare_filename(info)
    path = Path(filename)
    if not path.is_file():
        raise RuntimeError(f"yt-dlp reported success but file is missing: {filename}")
    return path


def extract_frames(video_path: Path, target_fps: float | None = None) -> list[np.ndarray]:
    """Decode a video file into a list of BGR frames, optionally resampled to target_fps."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video file: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    stride = 1.0
    if target_fps and target_fps > 0:
        stride = max(source_fps / target_fps, 1.0)

    frames: list[np.ndarray] = []
    next_take = 0.0
    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx >= next_take:
            frames.append(frame)
            next_take += stride
        frame_idx += 1
    cap.release()
    return frames
