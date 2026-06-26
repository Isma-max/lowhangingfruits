import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import { SelectedLine, Segment } from './types'

function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8' }
    )
    return parseFloat(result.trim()) || 0
  } catch {
    return 0
  }
}

export async function mixAndExport(
  videoPath: string,
  lines: SelectedLine[],
  segments: Segment[],
  audioDir: string,
  outputPath: string
): Promise<void> {
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true })

  const clipsDir = path.join(audioDir, 'clips')
  if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true })

  const clipPaths: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const line = lines.find((l) => l.segmentId === seg.id)
    const clipPath = path.join(clipsDir, `clip_${i}.mp4`)

    // cutStart: when the camera cut starts
    // endTime: when the mouth closes (hard cut here)
    const cutStart = seg.cutStart ?? seg.startTime
    const clipDuration = seg.endTime - cutStart

    if (clipDuration <= 0) continue

    const audioFile = line ? path.join(audioDir, `line_${line.segmentId}.mp3`) : null
    const hasAudio = audioFile && fs.existsSync(audioFile)

    if (hasAudio) {
      // Audio delay within this clip: mouth opens at (startTime - cutStart)
      const audioOffsetSec = Math.max(0, seg.startTime - cutStart)
      const audioOffsetMs = Math.round(audioOffsetSec * 1000)

      // Use actual synthesized audio duration to determine where the video cuts
      const rawAudioDuration = getAudioDuration(audioFile)
      const actualEndSec = cutStart + audioOffsetSec + rawAudioDuration
      const actualClipDuration = Math.min(actualEndSec - cutStart, clipDuration)

      // Build clip: video trimmed to actual audio end, audio placed at mouth-open offset
      execSync(
        `ffmpeg -y -ss ${cutStart.toFixed(3)} -t ${actualClipDuration.toFixed(3)} -i "${videoPath}" \
-i "${audioFile}" \
-filter_complex "[1:a]adelay=${audioOffsetMs}|${audioOffsetMs}[dubbed];[dubbed]atrim=0:${actualClipDuration.toFixed(3)}[out]" \
-map 0:v:0 -map "[out]" -c:v libx264 -preset fast -crf 22 -c:a aac "${clipPath}"`,
        { stdio: 'pipe' }
      )
    } else {
      // No audio for this segment — extract video only with silent audio
      execSync(
        `ffmpeg -y -ss ${cutStart.toFixed(3)} -t ${clipDuration.toFixed(3)} -i "${videoPath}" \
-f lavfi -i anullsrc=r=44100:cl=stereo \
-map 0:v:0 -map 1:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -shortest "${clipPath}"`,
        { stdio: 'pipe' }
      )
    }

    if (fs.existsSync(clipPath)) clipPaths.push(clipPath)
  }

  if (clipPaths.length === 0) {
    throw new Error('No video clips were generated')
  }

  // Concatenate all clips
  const concatList = path.join(clipsDir, 'concat.txt')
  fs.writeFileSync(concatList, clipPaths.map((p) => `file '${p}'`).join('\n'))

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${outputPath}"`,
    { stdio: 'inherit' }
  )

  if (!fs.existsSync(outputPath)) {
    throw new Error('Output file was not created by FFmpeg')
  }
}
