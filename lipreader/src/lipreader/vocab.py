"""Per-language character vocabularies used by the CTC decoding head.

Index 0 is reserved for the CTC blank symbol in every vocabulary.
"""

from __future__ import annotations

BLANK = "<blank>"

_LANGUAGE_CHARSETS = {
    "en": "abcdefghijklmnopqrstuvwxyz' ",
    "es": "abcdefghijklmnopqrstuvwxyzáéíóúñü' ",
}


class Vocab:
    def __init__(self, language: str):
        try:
            charset = _LANGUAGE_CHARSETS[language]
        except KeyError as exc:
            supported = ", ".join(sorted(_LANGUAGE_CHARSETS))
            raise ValueError(
                f"Unsupported language {language!r}. Supported: {supported}"
            ) from exc
        self.language = language
        self.symbols = [BLANK, *charset]
        self._index = {sym: i for i, sym in enumerate(self.symbols)}

    def __len__(self) -> int:
        return len(self.symbols)

    @property
    def blank_id(self) -> int:
        return 0

    def decode_ids(self, ids: list[int]) -> str:
        return "".join(self.symbols[i] for i in ids if i != self.blank_id)


def supported_languages() -> list[str]:
    return sorted(_LANGUAGE_CHARSETS)
