"""CTC prefix beam search decoding.

Returns the top-K most probable label sequences from a CTC log-prob matrix,
rather than a single greedy transcription — used here to surface the "3
most likely dialogue" candidates the pipeline is meant to produce.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

NEG_INF = float("-inf")


def _logaddexp(a: float, b: float) -> float:
    return float(np.logaddexp(a, b))


@dataclass
class Candidate:
    text: str
    log_prob: float


def ctc_beam_search(
    log_probs: np.ndarray,
    vocab,
    beam_width: int = 25,
    top_k: int = 3,
) -> list[Candidate]:
    """log_probs: (T, V) log-probabilities per timestep. vocab: Vocab instance."""
    T, _ = log_probs.shape
    blank = vocab.blank_id

    # beams: prefix (tuple of symbol ids, blanks/repeats already collapsed)
    #   -> (log_prob ending in blank, log_prob ending in non-blank)
    beams: dict[tuple[int, ...], tuple[float, float]] = {(): (0.0, NEG_INF)}

    for t in range(T):
        next_beams: dict[tuple[int, ...], tuple[float, float]] = {}

        def get(prefix):
            return next_beams.get(prefix, (NEG_INF, NEG_INF))

        for prefix, (p_b, p_nb) in beams.items():
            for symbol_id in range(log_probs.shape[1]):
                p = log_probs[t, symbol_id]

                if symbol_id == blank:
                    nb, nnb = get(prefix)
                    combined = _logaddexp(p_b, p_nb) + p
                    next_beams[prefix] = (_logaddexp(nb, combined), nnb)
                    continue

                end_symbol = prefix[-1] if prefix else None
                if symbol_id == end_symbol:
                    # repeat of last symbol: extends only via a preceding blank
                    nb, nnb = get(prefix)
                    next_beams[prefix] = (nb, _logaddexp(nnb, p_b + p))

                    new_prefix = prefix + (symbol_id,)
                    nb2, nnb2 = get(new_prefix)
                    next_beams[new_prefix] = (nb2, _logaddexp(nnb2, p_nb + p))
                else:
                    new_prefix = prefix + (symbol_id,)
                    nb2, nnb2 = get(new_prefix)
                    combined = _logaddexp(p_b, p_nb) + p
                    next_beams[new_prefix] = (nb2, _logaddexp(nnb2, combined))

        # prune to beam_width most probable prefixes
        scored = [
            (prefix, _logaddexp(p_b, p_nb)) for prefix, (p_b, p_nb) in next_beams.items()
        ]
        scored.sort(key=lambda kv: kv[1], reverse=True)
        pruned = scored[:beam_width]
        beams = {prefix: next_beams[prefix] for prefix, _ in pruned}

    ranked = sorted(
        ((prefix, _logaddexp(p_b, p_nb)) for prefix, (p_b, p_nb) in beams.items()),
        key=lambda kv: kv[1],
        reverse=True,
    )
    candidates = [
        Candidate(text=vocab.decode_ids(list(prefix)), log_prob=score)
        for prefix, score in ranked[:top_k]
    ]
    return candidates
