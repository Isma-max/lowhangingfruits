"""Mechanics smoke test: proves frames -> mouth ROI -> model -> ranked candidates
runs end-to-end without error. Does NOT assert transcription accuracy — the
model has random (untrained) weights, see lipreader/src/lipreader/model.py.
"""

from pathlib import Path

from lipreader import video_source, mouth_roi
from lipreader.decode import ctc_beam_search
from lipreader.model import build_model
from lipreader.vocab import Vocab
import torch

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
CLIP_PATH = FIXTURES_DIR / "synthetic_test_clip.mp4"


def test_frame_extraction():
    frames = video_source.extract_frames(CLIP_PATH, target_fps=25.0)
    assert len(frames) > 0
    assert frames[0].ndim == 3


def test_mouth_roi_extraction():
    frames = video_source.extract_frames(CLIP_PATH, target_fps=25.0)
    seq = mouth_roi.extract_mouth_sequence(frames, fps=25.0, roi_size=96)
    assert seq.shape[1:] == (96, 96)
    assert seq.shape[0] > 0
    assert seq.dtype.name == "uint8"


def test_model_and_decode_shapes():
    frames = video_source.extract_frames(CLIP_PATH, target_fps=25.0)
    seq = mouth_roi.extract_mouth_sequence(frames, fps=25.0, roi_size=96)

    vocab = Vocab("en")
    model = build_model(vocab_size=len(vocab), roi_size=96)
    model.eval()

    tensor = torch.from_numpy(seq).float().unsqueeze(0) / 255.0
    with torch.no_grad():
        log_probs = model(tensor)[0].numpy()

    assert log_probs.shape[0] == seq.shape[0]
    assert log_probs.shape[1] == len(vocab)

    candidates = ctc_beam_search(log_probs, vocab, top_k=3)
    assert len(candidates) == 3
    for c in candidates:
        assert isinstance(c.text, str)
