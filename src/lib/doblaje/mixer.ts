import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import { SelectedLine, Segment } from './types'

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
      const audioOffsetMs = Math.max(0, Math.round((seg.startTime - cutStart) * 1000))
      const audioDuration = seg.endTime - seg.startTime

      // Trim dubbed audio to mouth duration, then pad silence before/after within clip
      const trimmedAudio = path.join(clipsDir, `audio_${i}.mp3`)
      execSync(
        `ffmpeg -y -i "${audioFile}" -af "atrim=0:${audioDuration.toFixed(3)},asetpts=PTS-STARTPTS" "${trimmedAudio}"`,
        { stdio: 'pipe' }
      )

      // Build clip: video trimmed to endTime, audio placed at mouth-open offset
      execSync(
        `ffmpeg -y -ss ${cutStart.toFixed(3)} -t ${clipDuration.toFixed(3)} -i "${videoPath}" \
-i "${trimmedAudio}" \
-filter_complex "[1:a]adelay=${audioOffsetMs}|${audioOffsetMs},apad[dubbed];[dubbed]atrim=0:${clipDuration.toFixed(3)}[out]" \
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
