import OpenAI from 'openai'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Segment, Speaker, ScriptOption } from './types'
import { getAvailableVoices } from './tts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export interface VisionAnalysis {
  duration: number
  speakers: Speaker[]
  segments: Segment[]
  scriptOptions: ScriptOption[][]
}

function extractFrames(videoPath: string, framesDir: string): { duration: number; frameTimestamps: number[] } {
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true })

  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: 'utf8' }
  ).trim()
  const duration = parseFloat(durationStr) || 30

  // Extract max 12 frames spread evenly — annotate with timestamp in filename
  const numFrames = Math.min(12, Math.floor(duration))
  const interval = duration / numFrames

  const frameTimestamps: number[] = []
  for (let i = 0; i < numFrames; i++) {
    const ts = i * interval
    frameTimestamps.push(ts)
    execSync(
      `ffmpeg -y -ss ${ts.toFixed(2)} -i "${videoPath}" -vframes 1 -vf "scale=480:-1" "${framesDir}/frame_${String(i).padStart(3, '0')}_t${ts.toFixed(1)}.jpg"`,
      { stdio: 'pipe' }
    )
  }

  return { duration, frameTimestamps }
}

function frameToBase64(framePath: string): string {
  return fs.readFileSync(framePath).toString('base64')
}

function shuffle<T>(arr: T[]): T[] {
  return arr.sort(() => Math.random() - 0.5)
}

export async function analyzeAndGenerateWithVision(videoPath: string): Promise<VisionAnalysis> {
  const framesDir = path.join(
    path.dirname(videoPath),
    'frames_' + path.basename(videoPath, path.extname(videoPath))
  )

  const { duration, frameTimestamps } = extractFrames(videoPath, framesDir)

  const frameFiles = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).sort()

  // Build image messages with timestamp labels so GPT knows when each frame is
  const imageMessages: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  for (let i = 0; i < frameFiles.length; i++) {
    const ts = frameTimestamps[i] ?? i
    imageMessages.push({
      type: 'text',
      text: `[Frame en t=${ts.toFixed(1)}s]`,
    })
    imageMessages.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${frameToBase64(path.join(framesDir, frameFiles[i]))}`,
        detail: 'low',
      },
    })
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Eres un doblajista paródico chileno experto en leer labios.
Cada frame tiene su timestamp exacto. Usa esos timestamps para determinar CUÁNDO exactamente
alguien está hablando (labios en movimiento) y define el startTime y endTime de cada segmento
basado en lo que VES, no en lo que imaginas que dicen.

El doblaje debe ser en ESPAÑOL CHILENO absurdo e irreverente.`,
      },
      {
        role: 'user',
        content: [
          ...imageMessages,
          {
            type: 'text',
            text: `Video de ${duration.toFixed(2)} segundos. Los frames tienen timestamp exacto.

INSTRUCCIONES:
1. Identifica los momentos donde ves labios moviéndose (alguien habla)
2. Define startTime y endTime PRECISOS basados en los frames — estos son los timecodes reales
3. Para cada momento de habla, INVENTA un doblaje absurdo en chileno
4. El texto debe tener la misma cantidad de sílabas que lo que ves en los labios
5. Asigna speakerIndex diferente si ves personas distintas hablando

Genera entre 3 y 6 segmentos.

Responde SOLO con JSON:
{
  "segments": [
    {
      "startTime": <número con decimales, ej: 1.5>,
      "endTime": <número con decimales, ej: 4.2>,
      "speakerIndex": <0 o 1>,
      "lipContext": "<qué ves en los labios>",
      "sutil": "<doblaje sutil en chileno>",
      "exagerado": "<doblaje exagerado en chileno>",
      "absurdo": "<doblaje absurdo en chileno>"
    }
  ]
}`,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  })

  fs.rmSync(framesDir, { recursive: true, force: true })

  const parsed = JSON.parse(response.choices[0].message.content || '{}')
  const rawSegments: Array<{
    startTime: number
    endTime: number
    speakerIndex: number
    lipContext: string
    sutil: string
    exagerado: string
    absurdo: string
  }> = parsed.segments || []

  // Get all available voices and shuffle for variety
  const availableVoices = await getAvailableVoices()
  const shuffledVoices = shuffle([...availableVoices])

  // Create one speaker per unique speakerIndex, with a random voice each
  const speakerIndexes = [...new Set(rawSegments.map((s) => s.speakerIndex || 0))]
  const speakers: Speaker[] = speakerIndexes.map((idx, i) => {
    const voice = shuffledVoices[i % shuffledVoices.length] || shuffledVoices[0]
    return {
      id: `speaker_${idx}`,
      label: voice?.name || `Voz ${i + 1}`,
      voiceId: voice?.id || '',
    }
  })

  const segments: Segment[] = rawSegments.map((s) => ({
    id: uuidv4(),
    startTime: s.startTime,
    endTime: s.endTime,
    speakerId: `speaker_${s.speakerIndex || 0}`,
    emotion: 'absurdo',
    context: s.lipContext || '',
  }))

  const scriptOptions: ScriptOption[][] = rawSegments.map((s, i) => {
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
