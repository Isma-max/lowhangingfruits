#!/usr/bin/env python3
"""
Detects mouth open/close events in a video using MediaPipe Face Landmarker.
Outputs JSON with speaking segments (timecodes when mouth is open).
Usage: python3 detect_mouth.py <video_path>
"""

import sys
import json
import os
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

UPPER_LIP = 13
LOWER_LIP = 14


def get_model_path():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, 'face_landmarker.task')


def download_model_if_needed(model_path):
    if os.path.exists(model_path):
        return
    import urllib.request
    url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
    urllib.request.urlretrieve(url, model_path)


def detect_speaking_segments(video_path: str, threshold: float = 0.015, min_duration: float = 0.4):
    model_path = get_model_path()
    download_model_if_needed(model_path)

    base_options = mp_python.BaseOptions(model_asset_path=model_path)
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base_options,
        num_faces=4,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    landmarker = mp_vision.FaceLandmarker.create_from_options(options)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    frame_events = []

    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        ts = frame_idx / fps
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect(mp_image)

        if result.face_landmarks:
            for face_idx, landmarks in enumerate(result.face_landmarks):
                upper = landmarks[UPPER_LIP]
                lower = landmarks[LOWER_LIP]
                opening = abs(lower.y - upper.y)
                is_open = opening > threshold
                frame_events.append((ts, is_open, face_idx))

        frame_idx += 1

    cap.release()
    landmarker.close()

    segments = []
    faces = set(e[2] for e in frame_events)

    for face_idx in sorted(faces):
        face_frames = [(ts, is_open) for ts, is_open, fi in frame_events if fi == face_idx]

        in_segment = False
        seg_start = 0.0

        for ts, is_open in face_frames:
            if is_open and not in_segment:
                in_segment = True
                seg_start = ts
            elif not is_open and in_segment:
                in_segment = False
                seg_end = ts
                if seg_end - seg_start >= min_duration:
                    segments.append({
                        "startTime": round(seg_start, 2),
                        "endTime": round(seg_end, 2),
                        "speakerIndex": face_idx,
                        "duration": round(seg_end - seg_start, 2),
                    })

        if in_segment:
            seg_end = face_frames[-1][0]
            if seg_end - seg_start >= min_duration:
                segments.append({
                    "startTime": round(seg_start, 2),
                    "endTime": round(seg_end, 2),
                    "speakerIndex": face_idx,
                    "duration": round(seg_end - seg_start, 2),
                })

    segments.sort(key=lambda s: s["startTime"])
    segments = segments[:6]

    print(json.dumps({
        "duration": round(duration, 2),
        "segments": segments,
    }))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No video path provided"}))
        sys.exit(1)
    detect_speaking_segments(sys.argv[1])
