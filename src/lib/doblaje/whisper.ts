import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface TranscribedSegment {
  id: string
  text: string
  start: number
  end: number
  words: WordTimestamp[]
  speakerIndex: number
}

export async function transcribeVideo(videoPath: string): Promise<TranscribedSegment[]> {
  const audioPath = videoPath.replace(/\.[^.]+$/, '_audio.mp3')

  // Extract audio from video
  execSync(`ffmpeg -y -i "${videoPath}" -vn -ar 16000 -ac 1 -ab 64k "${audioPath}"`, {
    stdio: 'pipe',
  })

  const audioStream = fs.createReadStream(audioPath)

  const response = await openai.audio.transcriptions.create({
    file: audioStream,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  })

  // Clean up extracted audio
  fs.unlinkSync(audioPath)

  const segments = (response.segments || []) as Array<{
    id: number
    text: string
    start: number
    end: number
    words?: Array<{ word: string; start: number; end: number }>
  }>

  return segments.map((seg) => ({
    id: String(seg.id),
    text: seg.text.trim(),
    start: seg.start,
    end: seg.end,
    words: (seg.words || []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
    speakerIndex: 0,
  }))
}
