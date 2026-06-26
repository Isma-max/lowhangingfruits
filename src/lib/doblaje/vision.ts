import OpenAI from 'openai'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Segment, Speaker } from './types'
import { ScriptOption } from './types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Narrador' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Comentarista' },
]

export interface VisionAnalysis {
  duration: number
  speakers: Speaker[]
  segments: Segment[]
  scriptOptions: ScriptOption[][]
}

function extractFrames(videoPath: string, framesDir: string, fps = 1): number {
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true })

  // Get duration
  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: 'utf8' }
  ).trim()
  const duration = parseFloat(durationStr) || 30

  // Extract 1 frame per second, max 20 frames
  const actualFps = duration > 20 ? 20 / duration : fps
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "fps=${actualFps},scale=512:-1" "${framesDir}/frame_%03d.jpg"`,
    { stdio: 'pipe' }
  )

  return duration
}

function frameToBase64(framePath: string): string {
  return fs.readFileSync(framePath).toString('base64')
}

export async function analyzeAndGenerateWithVision(videoPath: string): Promise<VisionAnalysis> {
  const framesDir = path.join(path.dirname(videoPath), 'frames_' + path.basename(videoPath, path.extname(videoPath)))

  const duration = extractFrames(videoPath, framesDir)

  const frameFiles = fs.readdirSync(framesDir)
    .filter(f => f.endsWith('.jpg'))
    .sort()
    .slice(0, 10) // max 10 frames to keep cost low

  const imageMessages = frameFiles.map((f, i) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/jpeg;base64,${frameToBase64(path.join(framesDir, f))}`,
      detail: 'low' as const,
    },
  }))

  const segmentDuration = duration / Math.min(4, Math.max(2, Math.floor(duration / 5)))
  const numSegments = Math.round(duration / segmentDuration)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          ...imageMessages,
          {
            type: 'text',
            text: `Estos son frames de un video deportivo de ${duration.toFixed(1)} segundos.

Mira los labios, expresiones y contexto visual. IGNORA completamente lo que realmente dicen.
Inventa lo que PODRÍAN estar diciendo de forma absurda y cómica en ESPAÑOL CHILENO.

Divide el video en ${numSegments} segmentos y para cada uno genera 3 versiones de doblaje paródico chileno.

REGLAS:
- Usa chilenismos: "weon", "cachai", "la raja", "po", "al tiro", "bacán", "compadre", etc.
- Tono: absurdo, infantil, irreverente
- Cada texto debe durar aproximadamente ${segmentDuration.toFixed(1)} segundos (máx ~3 palabras por segundo)
- NO uses lo que realmente dicen, INVENTA algo completamente diferente pero con movimientos de labios similares

Responde SOLO con JSON válido:
{
  "segments": [
    {
      "startTime": <número>,
      "endTime": <número>,
      "speakerIndex": <0 o 1>,
      "lipContext": "<descripción breve de qué hacen los labios>",
      "sutil": "<versión sutil en chileno>",
      "exagerado": "<versión exagerada en chileno>",
      "absurdo": "<versión absurda en chileno>"
    }
  ]
}`,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
  })

  // Cleanup frames
  fs.rmSync(framesDir, { recursive: true, force: true })

  const parsed = JSON.parse(response.choices[0].message.content || '{}')
  const rawSegments = parsed.segments || []

  const speakers: Speaker[] = [
    { id: 'speaker_0', label: ELEVENLABS_VOICES[0].label, voiceId: ELEVENLABS_VOICES[0].id },
    { id: 'speaker_1', label: ELEVENLABS_VOICES[1].label, voiceId: ELEVENLABS_VOICES[1].id },
  ]

  const segments: Segment[] = rawSegments.map((s: {
    startTime: number; endTime: number; speakerIndex: number; lipContext: string
  }) => ({
    id: uuidv4(),
    startTime: s.startTime,
    endTime: s.endTime,
    speakerId: `speaker_${s.speakerIndex || 0}`,
    emotion: 'absurdo',
    context: s.lipContext || '',
  }))

  const scriptOptions: ScriptOption[][] = rawSegments.map((s: Record<string, string>, i: number) => {
    const seg = segments[i]
    if (!seg) return []
    const humors = ['sutil', 'exagerado', 'absurdo'] as const
    return humors.map((humor) => ({
      id: uuidv4(),
      segmentId: seg.id,
      text: s[humor] || '',
      humor,
    }))
  })

  return { duration, speakers, segments, scriptOptions }
}
