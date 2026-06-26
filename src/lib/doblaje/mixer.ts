import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import { SelectedLine } from './types'

export async function mixAndExport(
  videoPath: string,
  lines: SelectedLine[],
  audioDir: string,
  outputPath: string
): Promise<void> {
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true })

  const duration = getVideoDuration(videoPath)
  const silencePath = path.join(audioDir, 'silence.mp3')
  const mixedAudioPath = path.join(audioDir, 'mixed.mp3')

  // Generate silence base track
  execSync(
    `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} "${silencePath}"`,
    { stdio: 'inherit' }
  )

  // Build amix command with all audio files delayed to their start times
  const existingLines = lines.filter((line) =>
    fs.existsSync(path.join(audioDir, `line_${line.segmentId}.mp3`))
  )

  if (existingLines.length === 0) {
    // No audio lines, just copy silence
    fs.copyFileSync(silencePath, mixedAudioPath)
  } else {
    const inputs = [
      `-i "${silencePath}"`,
      ...existingLines.map((l) => `-i "${path.join(audioDir, `line_${l.segmentId}.mp3`)}"`),
    ].join(' ')

    const delays = existingLines
      .map((l, i) => {
        const delay = Math.round(l.startTime * 1000)
        return `[${i + 1}:a]adelay=${delay}|${delay}[a${i + 1}]`
      })
      .join(';')

    const mixLabels = ['[0:a]', ...existingLines.map((_, i) => `[a${i + 1}]`)].join('')
    const filterComplex = `${delays};${mixLabels}amix=inputs=${existingLines.length + 1}:normalize=0[out]`

    execSync(
      `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[out]" "${mixedAudioPath}"`,
      { stdio: 'inherit' }
    )
  }

  // Merge mixed audio with original video
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${mixedAudioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`,
    { stdio: 'inherit' }
  )

  if (!fs.existsSync(outputPath)) {
    throw new Error('Output file was not created by FFmpeg')
  }
}

function getVideoDuration(videoPath: string): number {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: 'utf8' }
  )
  return parseFloat(result.trim()) || 30
}
