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

  const existingLines = lines.filter((line) =>
    fs.existsSync(path.join(audioDir, `line_${line.segmentId}.mp3`))
  )

  if (existingLines.length === 0) {
    // No audio lines — copy video as-is with silent audio
    execSync(
      `ffmpeg -y -i "${videoPath}" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v copy -c:a aac -shortest "${outputPath}"`,
      { stdio: 'inherit' }
    )
    return
  }

  // For each line: pad with silence so it starts at the right timestamp
  // Strategy: [silence of startTime seconds] + [voice audio] — then mix all tracks
  const paddedPaths: string[] = []

  for (const line of existingLines) {
    const srcPath = path.join(audioDir, `line_${line.segmentId}.mp3`)
    const paddedPath = path.join(audioDir, `padded_${line.segmentId}.mp3`)
    const delayMs = Math.round(line.startTime * 1000)
    const maxDur = line.endTime - line.startTime

    // Trim to segment length, then pad silence at the start
    execSync(
      `ffmpeg -y -i "${srcPath}" -af "atrim=0:${maxDur.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},apad=pad_dur=${(duration - line.startTime).toFixed(3)}" -t ${duration.toFixed(3)} "${paddedPath}"`,
      { stdio: 'pipe' }
    )
    paddedPaths.push(paddedPath)
  }

  // Mix all padded tracks together
  const mixedAudioPath = path.join(audioDir, 'mixed.aac')
  const inputs = paddedPaths.map((p) => `-i "${p}"`).join(' ')
  const amix = `amix=inputs=${paddedPaths.length}:normalize=0:dropout_transition=0`

  execSync(
    `ffmpeg -y ${inputs} -filter_complex "${amix}" -t ${duration.toFixed(3)} "${mixedAudioPath}"`,
    { stdio: 'inherit' }
  )

  // Merge mixed audio with original video (replace audio track)
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
