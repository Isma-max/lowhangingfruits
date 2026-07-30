"""Gradio UI: upload/point to a VOD, see the distinct people detected in it,
assign each one a spoken language, then get each person's top-3 most likely
dialogue (visual-only — audio is never read).
"""

from __future__ import annotations

import cv2
import gradio as gr

from .transcribe import DiscoveryResult, discover_characters, transcribe_characters
from .vocab import supported_languages

MAX_CHARACTERS = 6


def _run_discovery(video_file, video_url):
    source = video_file or video_url
    if not source:
        raise gr.Error("Sube un video o pega una URL.")

    discovery = discover_characters(source)
    character_ids = sorted(discovery.characters)

    group_updates = []
    thumb_updates = []
    label_updates = []
    lang_updates = []
    for i in range(MAX_CHARACTERS):
        if i < len(character_ids):
            cid = character_ids[i]
            thumb = cv2.cvtColor(discovery.characters[cid].thumbnail, cv2.COLOR_BGR2RGB)
            group_updates.append(gr.update(visible=True))
            thumb_updates.append(gr.update(value=thumb))
            label_updates.append(gr.update(value=f"**{cid}**"))
            lang_updates.append(gr.update(value=None))
        else:
            group_updates.append(gr.update(visible=False))
            thumb_updates.append(gr.update(value=None))
            label_updates.append(gr.update(value=""))
            lang_updates.append(gr.update(value=None))

    status = f"Se detectaron {len(character_ids)} persona(s). Asigná el idioma de cada una y presioná Transcribir."
    return (discovery, character_ids, status, *group_updates, *thumb_updates, *label_updates, *lang_updates)


def _run_transcription(discovery: DiscoveryResult, character_ids: list[str], *languages):
    if discovery is None:
        raise gr.Error("Primero detectá los personajes.")

    character_languages = {
        cid: lang for cid, lang in zip(character_ids, languages) if lang
    }
    if not character_languages:
        raise gr.Error("Asigná al menos un idioma.")

    results = transcribe_characters(discovery, character_languages)

    lines = []
    for cid in character_ids:
        candidates = results.get(cid)
        if not candidates:
            continue
        lines.append(f"### {cid} ({character_languages[cid]})")
        for i, cand in enumerate(candidates, 1):
            lines.append(f"{i}. `{cand.text}` (score {cand.log_prob:.1f})")
        lines.append("")
    return "\n".join(lines)


def build_app() -> gr.Blocks:
    languages = supported_languages()

    with gr.Blocks(title="lipreader") as demo:
        gr.Markdown(
            "# lipreader\n"
            "Detecta a las personas que aparecen en un VOD, asignale un idioma a cada una, "
            "y obtené las 3 transcripciones más probables de lo que dice cada una — "
            "analizando solo el video, sin usar el audio.\n\n"
            "**Nota:** el modelo de reconocimiento visual todavía no está entrenado "
            "(ver README) — esta UI valida el flujo completo, no la precisión del texto."
        )

        discovery_state = gr.State(None)
        character_ids_state = gr.State([])

        with gr.Row():
            video_file = gr.Video(label="Subir video")
            video_url = gr.Textbox(label="...o URL del video (VOD)")

        detect_btn = gr.Button("1. Detectar personajes")
        status = gr.Markdown()

        char_groups, char_thumbs, char_labels, char_langs = [], [], [], []
        with gr.Row():
            for i in range(MAX_CHARACTERS):
                with gr.Column(visible=False) as group:
                    thumb = gr.Image(label="", interactive=False, height=150)
                    label = gr.Markdown()
                    lang = gr.Dropdown(choices=languages, label="Idioma")
                char_groups.append(group)
                char_thumbs.append(thumb)
                char_labels.append(label)
                char_langs.append(lang)

        transcribe_btn = gr.Button("2. Transcribir")
        output = gr.Markdown()

        detect_btn.click(
            _run_discovery,
            inputs=[video_file, video_url],
            outputs=[discovery_state, character_ids_state, status, *char_groups, *char_thumbs, *char_labels, *char_langs],
        )
        transcribe_btn.click(
            _run_transcription,
            inputs=[discovery_state, character_ids_state, *char_langs],
            outputs=[output],
        )

    return demo


def main() -> None:
    build_app().launch()


if __name__ == "__main__":
    main()
