import { GoogleAIFileManager } from '@google/generative-ai/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Segment, Speaker } from './types'
import { v4 as uuidv4 } from 'uuid'

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!)
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

async function uploadAndWait(videoPath: string): Promise<string> {
  const ext = videoPath.split('.').pop()?.toLowerCase() || 'mp4'
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  }
  const mimeType = mimeMap[ext] || 'video/mp4'

  const uploadResult = await fileManager.uploadFile(videoPath, { mimeType })
  let file = uploadResult.file

  while (file.state === 'PROCESSING') {
    await new Promise((r) => setTimeout(r, 3000))
    file = await fileManager.getFile(file.name)
  }

  if (file.state === 'FAILED') throw new Error('Video processing failed in Gemini')
  return file.uri
}

export async function analyzeVideo(videoPath: string): Promise<VideoAnalysis> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const fileUri = await uploadAndWait(videoPath)
  const ext = videoPath.split('.').pop()?.toLowerCase() || 'mp4'
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo',
  }

  const prompt = `Analiza este video deportivo y responde SOLO con JSON válido, sin markdown ni explicaciones:
{
  "duration": <duración total en segundos como número>,
  "numSpeakers": <número de personas/locutores detectados, entre 1 y 4>,
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

Detecta entre 2 y 5 segmentos. Cada segmento debe durar al menos 2 segundos.`

  const result = await model.generateContent([
    { fileData: { mimeType: mimeMap[ext] || 'video/mp4', fileUri } },
    prompt,
  ])

  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(text)

  const speakers: Speaker[] = Array.from({ length: Math.max(1, parsed.numSpeakers || 2) }, (_, i) => ({
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

  return { duration: parsed.duration || 30, speakers, segments }
}
