#!/usr/bin/env python3
"""
Detects mouth open/close events in a video using MediaPipe Face Mesh.
Outputs JSON with speaking segments (timecodes when mouth is open).
Usage: python3 detect_mouth.py <video_path>
"""

import sys
import json
import cv2
import mediapipe as mp

# MediaPipe lip landmarks (upper and lower lip center points)
UPPER_LIP = 13
LOWER_LIP = 14

def detect_speaking_segments(video_path: str, threshold: float = 0.015, min_duration: float = 0.4):
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=4,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    frame_events = []  # (timestamp, is_speaking, face_index)

    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        ts = frame_idx / fps
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        if results.multi_face_landmarks:
            for face_idx, landmarks in enumerate(results.multi_face_landmarks):
                upper = landmarks.landmark[UPPER_LIP]
                lower = landmarks.landmark[LOWER_LIP]
                opening = abs(lower.y - upper.y)
                is_open = opening > threshold
                frame_events.append((ts, is_open, face_idx))

        frame_idx += 1

    cap.release()
    face_mesh.close()

    # Group into speaking segments per face
    segments = []
    faces = set(e[2] for e in frame_events)

    for face_idx in sorted(faces):
        face_frames = [(ts, is_open) for ts, is_open, fi in frame_events if fi == face_idx]

        in_segment = False
        seg_start = 0.0

        for i, (ts, is_open) in enumerate(face_frames):
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

    # Sort by startTime and merge overlapping segments from different faces
    segments.sort(key=lambda s: s["startTime"])

    # Limit to max 6 segments
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
