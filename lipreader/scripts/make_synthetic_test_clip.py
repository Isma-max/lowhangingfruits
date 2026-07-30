"""Build a short synthetic test clip for smoke-testing the pipeline mechanics.

This is NOT a substitute for a real talking-head video — it takes a single
real face photo and jitters it slightly frame to frame, which is enough to
exercise face/mouth detection across a video, but has no real lip motion.
Real accuracy testing needs an actual clip of someone speaking (YouTube
downloads are blocked from this sandbox; see lipreader/README.md).
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
SOURCE_IMAGE = FIXTURES_DIR / "test_face.jpg"
OUTPUT_VIDEO = FIXTURES_DIR / "synthetic_test_clip.mp4"


def main(num_frames: int = 50, fps: int = 25) -> None:
    img = cv2.imread(str(SOURCE_IMAGE))
    if img is None:
        raise FileNotFoundError(f"Missing source image: {SOURCE_IMAGE}")
    h, w = img.shape[:2]

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(OUTPUT_VIDEO), fourcc, fps, (w, h))

    rng = np.random.default_rng(seed=0)
    for _ in range(num_frames):
        dx, dy = rng.integers(-4, 5, size=2)
        matrix = np.float32([[1, 0, dx], [0, 1, dy]])
        frame = cv2.warpAffine(img, matrix, (w, h), borderMode=cv2.BORDER_REPLICATE)
        writer.write(frame)
    writer.release()
    print(f"Wrote {num_frames} frames to {OUTPUT_VIDEO}")


if __name__ == "__main__":
    main()
