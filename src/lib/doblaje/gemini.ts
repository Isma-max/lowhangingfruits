import { GoogleGenerativeAI } from '@google/generative-ai'
import * as fs from 'fs'
import { Segment, Speaker } from './types'
import { v4 as uuidv4 } from 'uuid'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface VideoAnalysis {
  duration: number
  speakers: Speaker[]
  segments: Segment[]
}

const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli' },
]

export async function analyzeVideo(videoPath: string): Promise<VideoAnalysis> {
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const videoData = fs.readFileSync(videoPath)
  const base64Video = videoData.toString('base64')

  const ext = videoPath.split('.').pop()?.toLowerCase() || 'mp4'
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  }
  const mimeType = mimeMap[ext] || 'video/mp4'

  const prompt = `Analiza este video deportivo y responde SOLO con JSON válido, sin markdown ni explicaciones:
{
  "duration": <duración total en segundos como número>,
  "numSpeakers": <número de personas/locutores detectados>,
  "segments": [
    {
      "startTime": <tiempo inicio en segundos>,
      "endTime": <tiempo fin en segundos>,
      "speakerIndex": <índice del hablante 0-based>,
      "emotion": <"emocionado"|"tranquilo"|"tenso"|"celebrando"|"narrando">,
      "context": <descripción breve de qué pasa en la escena en español>
    }
  ]
}

Detecta entre 2 y 6 segmentos según los cambios de escena o de locutor. Cada segmento debe durar al menos 2 segundos.`

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Video } },
    prompt,
  ])

  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(text)

  const speakers: Speaker[] = Array.from({ length: parsed.numSpeakers || 2 }, (_, i) => ({
    id: `speaker_${i}`,
    label: `Locutor ${i + 1}`,
    voiceId: ELEVENLABS_VOICES[i % ELEVENLABS_VOICES.length].id,
  }))

  const segments: Segment[] = (parsed.segments || []).map((s: { startTime: number; endTime: number; speakerIndex: number; emotion: string; context: string }) => ({
    id: uuidv4(),
    startTime: s.startTime,
    endTime: s.endTime,
    speakerId: `speaker_${s.speakerIndex || 0}`,
    emotion: s.emotion || 'narrando',
    context: s.context || '',
  }))

  return {
    duration: parsed.duration || 30,
    speakers,
    segments,
  }
}
