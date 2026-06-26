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

interface MouthSegment {
  startTime: number
  endTime: number
  speakerIndex: number
  duration: number
}

function detectMouthSegments(videoPath: string): { duration: number; segments: MouthSegment[] } {
  const scriptPath = path.join(process.cwd(), 'scripts', 'detect_mouth.py')
  const result = execSync(`python3 "${scriptPath}" "${videoPath}"`, { encoding: 'utf8' })
  return JSON.parse(result.trim())
}

function extractFrameAtTime(videoPath: string, timestamp: number, outputPath: string) {
  execSync(
    `ffmpeg -y -ss ${timestamp.toFixed(2)} -i "${videoPath}" -vframes 1 -vf "scale=480:-1" "${outputPath}"`,
    { stdio: 'pipe' }
  )
}

function frameToBase64(framePath: string): string {
  return fs.readFileSync(framePath).toString('base64')
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function analyzeAndGenerateWithVision(videoPath: string): Promise<VisionAnalysis> {
  // Step 1: Detect mouth open segments with MediaPipe
  const mouthData = detectMouthSegments(videoPath)
  const { duration, segments: mouthSegments } = mouthData

  // If no mouth segments detected, create evenly spaced fallback segments
  const rawSegments: MouthSegment[] = mouthSegments.length > 0
    ? mouthSegments
    : Array.from({ length: 3 }, (_, i) => ({
        startTime: (duration / 3) * i,
        endTime: (duration / 3) * (i + 1) - 0.2,
        speakerIndex: i % 2,
        duration: duration / 3,
      }))

  // Step 2: Extract one representative frame per segment
  const tmpDir = path.join(path.dirname(videoPath), 'tmp_frames_' + path.basename(videoPath, path.extname(videoPath)))
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const imageMessages: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i]
    const midpoint = (seg.startTime + seg.endTime) / 2
    const framePath = path.join(tmpDir, `seg_${i}.jpg`)
    extractFrameAtTime(videoPath, midpoint, framePath)

    imageMessages.push({ type: 'text', text: `[Segmento ${i + 1}: t=${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s, boca abierta detectada]` })
    imageMessages.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frameToBase64(framePath)}`, detail: 'low' },
    })
  }

  // Step 3: GPT-4o invents Chilean parody dialogue for each segment
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Eres un doblajista paródico chileno experto en fonética visual (visemas).

REGLAS DE VISEMAS — úsalas para que el texto inventado calce con los movimientos de boca:
- Labios JUNTOS/CERRADOS → palabras que empiezan con B, P, M (ej: "pero", "mira", "bien")
- Labios REDONDEADOS → palabras con O, U (ej: "todo", "weon", "po")
- Boca MUY ABIERTA → palabras con A fuerte (ej: "la raja", "bacán", "aah")
- Boca ESTIRADA horizontal → palabras con E, I (ej: "si", "mierda", "eso")
- Dientes VISIBLES → F, V, S (ej: "filo", "vai a ver", "si po")
- Boca APENAS ABIERTA → consonantes suaves, murmullos

Cuando veas la imagen del frame, fíjate en la FORMA exacta de la boca y elige palabras cuya primera sílaba tenga el visema correspondiente.

Tu trabajo es INVENTAR diálogo absurdo en chileno que calce con lo que ves en los labios.`,
      },
      {
        role: 'user',
        content: [
          ...imageMessages,
          {
            type: 'text',
            text: `Video deportivo de ${duration.toFixed(1)}s. MediaPipe detectó ${rawSegments.length} momentos donde alguien habla.
Los timecodes YA ESTÁN DEFINIDOS — NO los cambies.

Para cada segmento:
1. Describe la FORMA EXACTA de la boca en el frame (labios juntos, redondeados, abiertos, etc)
2. Basándote en esa forma, elige palabras cuya fonética calce con el visema
3. Inventa 3 versiones de doblaje en CHILENO con actitud

Versiones:
- sutil: levemente cómico, chilenismos suaves, fonética calza con labios
- exagerado: muy dramático, más chilenismos, fonética calza con labios
- absurdo: completamente ridículo, máximo garabatos, fonética calza con labios

Responde SOLO con JSON:
{
  "segments": [
    {
      "segmentIndex": <0-based>,
      "lipContext": "<forma exacta de boca que ves: labios juntos/redondeados/abiertos/etc>",
      "viseme": "<visema detectado: B-P-M / O-U / A / E-I / F-V-S>",
      "sutil": "<texto con fonética que calza>",
      "exagerado": "<texto con fonética que calza>",
      "absurdo": "<texto con fonética que calza>"
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

  fs.rmSync(tmpDir, { recursive: true, force: true })

  const parsed = JSON.parse(response.choices[0].message.content || '{}')
  const gptSegments: Array<{ segmentIndex: number; lipContext: string; sutil: string; exagerado: string; absurdo: string }> = parsed.segments || []

  // Step 4: Assign random voices from ElevenLabs account
  const allVoices = await getAvailableVoices()
  const shuffledVoices = shuffle(allVoices)
  const speakerIndexes = [...new Set(rawSegments.map((s) => s.speakerIndex))]

  const speakers: Speaker[] = speakerIndexes.map((idx, i) => {
    const voice = shuffledVoices[i % shuffledVoices.length]
    return { id: `speaker_${idx}`, label: voice?.name || `Voz ${i + 1}`, voiceId: voice?.id || '' }
  })

  const segments: Segment[] = rawSegments.map((s) => ({
    id: uuidv4(),
    startTime: s.startTime,
    endTime: s.endTime,
    speakerId: `speaker_${s.speakerIndex}`,
    emotion: 'absurdo',
    context: gptSegments.find((g) => g.segmentIndex === rawSegments.indexOf(s))?.lipContext || '',
  }))

  const scriptOptions: ScriptOption[][] = segments.map((seg, i) => {
    const gpt = gptSegments.find((g) => g.segmentIndex === i)
    if (!gpt) return []
    const humors = ['sutil', 'exagerado', 'absurdo'] as const
    return humors.map((humor) => ({
      id: uuidv4(),
      segmentId: seg.id,
      text: gpt[humor] || '',
      humor,
    }))
  })

  return { duration, speakers, segments, scriptOptions }
}
