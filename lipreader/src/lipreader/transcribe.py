"""End-to-end orchestration: VOD source -> mouth ROI sequence -> model -> ranked text candidates."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from . import mouth_roi, video_source
from .decode import Candidate, ctc_beam_search
from .model import build_model, load_pretrained
from .vocab import Vocab

TARGET_FPS = 25.0
ROI_SIZE = 96


def transcribe(
    source: str,
    language: str,
    top_k: int = 3,
    checkpoint_path: Path | None = None,
    cache_dir: Path | None = None,
) -> list[Candidate]:
    """Run the full pipeline on a VOD file path or URL.

    The video's audio track, if any, is never read — only decoded video
    frames are used, matching the visual-only lip-reading approach.
    """
    vocab = Vocab(language)

    local_path = video_source.resolve_to_local_file(source, cache_dir=cache_dir)
    frames = video_source.extract_frames(local_path, target_fps=TARGET_FPS)
    if not frames:
        raise RuntimeError(f"No frames decoded from {source}")

    mouth_seq = mouth_roi.extract_mouth_sequence(frames, fps=TARGET_FPS, roi_size=ROI_SIZE)

    model = build_model(vocab_size=len(vocab), roi_size=ROI_SIZE)
    load_pretrained(model, checkpoint_path)
    model.eval()

    tensor = torch.from_numpy(mouth_seq).float().unsqueeze(0) / 255.0  # (1, T, H, W)
    with torch.no_grad():
        log_probs = model(tensor)[0].numpy()  # (T, V)

    return ctc_beam_search(log_probs, vocab, top_k=top_k)
