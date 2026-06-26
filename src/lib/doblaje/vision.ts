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

function detectSceneCuts(videoPath: string): { duration: number; segments: MouthSegment[] } {
  const scriptPath = path.join(process.cwd(), 'scripts', 'detect_cuts.py')
  const result = execSync(`python3 "${scriptPath}" "${videoPath}"`, { encoding: 'utf8' })
  return JSON.parse(result.trim())
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
  // Step 1: Use scene cuts as primary timing source (matches camera edits in sports clips)
  // Fall back to mouth detection if cuts are too few
  const cutData = detectSceneCuts(videoPath)
  const { duration } = cutData

  let rawSegments: MouthSegment[] = cutData.segments

  if (rawSegments.length < 2) {
    const mouthData = detectMouthSegments(videoPath)
    rawSegments = mouthData.segments
  }

  // Final fallback: evenly spaced segments
  if (rawSegments.length === 0) {
    rawSegments = Array.from({ length: 4 }, (_, i) => ({
      startTime: (duration / 4) * i,
      endTime: (duration / 4) * (i + 1) - 0.1,
      speakerIndex: i % 2,
      duration: duration / 4,
    }))
  }

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
        content: `Eres un doblajista paródico chileno experto en fonética visual (visemas). Tu trabajo es inventar diálogo VARIADO, creativo y gracioso — NUNCA repitas la misma frase ni el mismo inicio entre segmentos.

REGLAS DE VISEMAS — la PRIMERA palabra de cada línea debe calzar con la forma de la boca:
- Labios JUNTOS/CERRADOS → empieza con B, P, M (ej: "Pero weón", "Mira esto", "Basta ya")
- Labios REDONDEADOS → empieza con O, U o sílaba redonda (ej: "Oye", "Weon", "Todo")
- Boca MUY ABIERTA → empieza con A (ej: "A la raja", "Ahí va", "Apúrate") — pero el RESTO de la frase debe ser DIFERENTE entre segmentos
- Boca ESTIRADA horizontal → empieza con E, I (ej: "Es que", "Increíble", "Sí po")
- Dientes VISIBLES → empieza con F, V, S (ej: "Filo", "Vai a ver", "Sácate")

REGLAS DE CONTENIDO — OBLIGATORIO:
- Cada segmento debe hablar de un TEMA DISTINTO (comida, plata, familia, fútbol, política, pololeo, etc.)
- NUNCA uses "Aah" o "Aaah" como inicio — si la boca está abierta usa una palabra real con A
- sutil: chilenismo suave, situación cotidiana
- exagerado: drama máximo, exageración ridícula
- absurdo: sin sentido total, non-sequitur, con garabatos si aplica
- Las 3 versiones de cada segmento deben ser MUY diferentes entre sí`,
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
1. Describe la FORMA EXACTA de la boca (labios juntos/redondeados/muy abiertos/estirados/dientes visibles)
2. Elige el visema correspondiente
3. Inventa 3 versiones MUY DISTINTAS entre sí, sobre temas DIFERENTES a los otros segmentos
4. La primera palabra DEBE calzar con el visema. El resto puede ser libre y creativo.

IMPORTANTE: Si varios segmentos tienen "boca muy abierta", igual deben tener frases COMPLETAMENTE distintas en contenido y tema.

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
