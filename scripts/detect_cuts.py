#!/usr/bin/env python3
"""
Detects scene cuts in a video using ffmpeg's scene change detection.
Outputs JSON with segments defined by each cut.
Usage: python3 detect_cuts.py <video_path>
"""

import sys
import json
import subprocess
import re


def detect_scene_cuts(video_path: str, threshold: float = 0.3):
    # Use ffmpeg to detect scene changes
    cmd = [
        'ffmpeg', '-i', video_path,
        '-vf', f'select=gt(scene\\,{threshold}),showinfo',
        '-vsync', 'vfr',
        '-f', 'null', '-'
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stderr

    # Extract timestamps from showinfo output
    cut_times = [0.0]
    for line in output.splitlines():
        m = re.search(r'pts_time:([\d.]+)', line)
        if m:
            t = float(m.group(1))
            if t > 0.1:
                cut_times.append(round(t, 2))

    # Get total duration
    dur_match = re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)', output)
    if dur_match:
        h, m, s = dur_match.groups()
        duration = int(h) * 3600 + int(m) * 60 + float(s)
    else:
        duration = cut_times[-1] + 3.0 if len(cut_times) > 1 else 10.0

    duration = round(duration, 2)
    cut_times = sorted(set(cut_times))

    # Build segments: each cut defines a segment from cut_time to next_cut_time
    segments = []
    for i, start in enumerate(cut_times):
        end = cut_times[i + 1] if i + 1 < len(cut_times) else duration
        seg_duration = round(end - start, 2)
        if seg_duration >= 0.5:  # ignore very short cuts
            segments.append({
                "startTime": start,
                "endTime": round(end - 0.05, 2),  # small buffer before next cut
                "speakerIndex": i % 2,
                "duration": seg_duration,
            })

    # Limit to 8 segments
    segments = segments[:8]

    print(json.dumps({
        "duration": duration,
        "segments": segments,
    }))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No video path provided"}))
        sys.exit(1)
    detect_scene_cuts(sys.argv[1])
