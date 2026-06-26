import ffmpeg from 'fluent-ffmpeg'
import * as path from 'path'
import * as fs from 'fs'
import { SelectedLine } from './types'

export async function mixAndExport(
  videoPath: string,
  lines: SelectedLine[],
  audioDir: string,
  outputPath: string
): Promise<void> {
  const silencePath = path.join(audioDir, 'silence.mp3')
  const mixedAudioPath = path.join(audioDir, 'mixed.mp3')

  await getVideoDuration(videoPath).then((duration) =>
    generateSilence(silencePath, duration)
  )

  const filterInputs: string[] = [silencePath]
  const filterParts: string[] = ['[0:a]']

  lines.forEach((line, i) => {
    const audioFile = path.join(audioDir, `line_${line.segmentId}.mp3`)
    if (!fs.existsSync(audioFile)) return
    filterInputs.push(audioFile)
    filterParts.push(`[${i + 1}:a]adelay=${Math.round(line.startTime * 1000)}|${Math.round(line.startTime * 1000)}`)
  })

  await new Promise<void>((resolve, reject) => {
    let cmd = ffmpeg()

    filterInputs.forEach((f) => cmd = cmd.input(f))

    const delayFilters = lines
      .map((line, i) => {
        const audioFile = path.join(audioDir, `line_${line.segmentId}.mp3`)
        if (!fs.existsSync(audioFile)) return null
        const delay = Math.round(line.startTime * 1000)
        return `[${i + 1}:a]adelay=${delay}|${delay}[a${i + 1}]`
      })
      .filter(Boolean)

    const mixInputs = ['[0:a]', ...lines.map((_, i) => `[a${i + 1}]`)].join('')
    const filterComplex = [
      ...delayFilters,
      `${mixInputs}amix=inputs=${lines.length + 1}:normalize=0[out]`,
    ].join(';')

    cmd
      .complexFilter(filterComplex, 'out')
      .output(mixedAudioPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(mixedAudioPath)
      .outputOptions(['-c:v copy', '-map 0:v:0', '-map 1:a:0', '-shortest'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) reject(err)
      else resolve(meta.format.duration || 60)
    })
  })
}

function generateSilence(outputPath: string, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anullsrc=r=44100:cl=stereo')
      .inputOptions(['-f lavfi'])
      .outputOptions([`-t ${duration}`, '-ar 44100', '-ac 2'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}
