"""Visual speech recognition model: 3D-CNN frontend + BiGRU encoder + CTC head.

IMPORTANT — this architecture is a working *scaffold*, not a trained model.
Real lip-reading (visual speech recognition) requires training on hours of
aligned video/transcript data (datasets like LRS3, LRW) with serious GPU
time; that isn't something this session can produce. `load_pretrained()`
is the plug-in point for real weights once you have (or can reach) a
checkpoint — e.g. a converted Auto-AVSR/LipNet checkpoint. Without one, the
model runs with random weights, so its transcriptions are not meaningful;
what's validated here is that the end-to-end mechanics (frames -> mouth ROI
-> features -> CTC decode -> ranked text candidates) work correctly.
"""

from __future__ import annotations

import warnings
from pathlib import Path

import torch
from torch import nn


class VisualSpeechRecognizer(nn.Module):
    def __init__(self, vocab_size: int, roi_size: int = 96, rnn_hidden: int = 256, rnn_layers: int = 2):
        super().__init__()
        self.frontend = nn.Sequential(
            nn.Conv3d(1, 32, kernel_size=(3, 5, 5), stride=(1, 2, 2), padding=(1, 2, 2)),
            nn.BatchNorm3d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(kernel_size=(1, 2, 2)),
            nn.Conv3d(32, 64, kernel_size=(3, 5, 5), stride=(1, 1, 1), padding=(1, 2, 2)),
            nn.BatchNorm3d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(kernel_size=(1, 2, 2)),
        )
        # conv1 stride 2 -> pool1 /2 -> conv2 stride 1 -> pool2 /2 == /8 total
        feat_spatial = roi_size // 8
        self.feature_dim = 64 * feat_spatial * feat_spatial

        self.temporal = nn.GRU(
            input_size=self.feature_dim,
            hidden_size=rnn_hidden,
            num_layers=rnn_layers,
            batch_first=True,
            bidirectional=True,
        )
        self.head = nn.Linear(rnn_hidden * 2, vocab_size)

    def forward(self, mouth_seq: torch.Tensor) -> torch.Tensor:
        """mouth_seq: (B, T, H, W) float in [0, 1]. Returns log-probs (B, T, vocab_size)."""
        x = mouth_seq.unsqueeze(1)  # (B, 1, T, H, W)
        x = self.frontend(x)  # (B, C, T, H', W')
        b, c, t, h, w = x.shape
        x = x.permute(0, 2, 1, 3, 4).reshape(b, t, c * h * w)
        x, _ = self.temporal(x)
        logits = self.head(x)
        return torch.log_softmax(logits, dim=-1)


def build_model(vocab_size: int, roi_size: int = 96) -> VisualSpeechRecognizer:
    return VisualSpeechRecognizer(vocab_size=vocab_size, roi_size=roi_size)


def load_pretrained(model: VisualSpeechRecognizer, checkpoint_path: Path | None) -> VisualSpeechRecognizer:
    if checkpoint_path is None:
        warnings.warn(
            "No pretrained checkpoint provided — running with random weights. "
            "Transcriptions will not be meaningful; see model.py docstring.",
            stacklevel=2,
        )
        return model
    state_dict = torch.load(checkpoint_path, map_location="cpu")
    model.load_state_dict(state_dict)
    return model
