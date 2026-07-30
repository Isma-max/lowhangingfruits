from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .transcribe import transcribe
from .vocab import supported_languages


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Read the top-K most likely spoken dialogue from a VOD's video alone (no audio used)."
    )
    parser.add_argument("source", help="Local video file path or a video URL (downloaded via yt-dlp).")
    parser.add_argument(
        "--language",
        required=True,
        choices=supported_languages(),
        help="Language the speakers are using — sets the decoding vocabulary.",
    )
    parser.add_argument("--top-k", type=int, default=3, help="Number of ranked candidate transcripts to return.")
    parser.add_argument("--checkpoint", type=Path, default=None, help="Path to pretrained model weights (.pt).")
    args = parser.parse_args(argv)

    candidates = transcribe(
        args.source,
        language=args.language,
        top_k=args.top_k,
        checkpoint_path=args.checkpoint,
    )
    for i, cand in enumerate(candidates, 1):
        print(f"{i}. ({cand.log_prob:.2f}) {cand.text!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
