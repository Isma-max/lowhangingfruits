"""Mechanics smoke test for the multi-character discovery/transcription path."""

from pathlib import Path

from lipreader.transcribe import discover_characters, transcribe_characters
from lipreader.ui import build_app

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
CLIP_PATH = FIXTURES_DIR / "synthetic_test_clip.mp4"


def test_discover_characters_finds_one_person_in_single_face_clip():
    discovery = discover_characters(str(CLIP_PATH))
    assert len(discovery.characters) == 1
    (character_id,) = discovery.characters.keys()
    assert character_id == "character_1"
    assert discovery.characters[character_id].thumbnail.size > 0


def test_transcribe_characters_returns_ranked_candidates_per_language():
    discovery = discover_characters(str(CLIP_PATH))
    results = transcribe_characters(discovery, {"character_1": "es"})
    assert "character_1" in results
    assert len(results["character_1"]) == 3
    for cand in results["character_1"]:
        assert isinstance(cand.text, str)


def test_ui_builds_without_error():
    demo = build_app()
    assert demo is not None
