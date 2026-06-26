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

interface RawCut {
  startTime: number
  endTime: number
  speakerIndex: number
  duration: number
}

interface RefinedSegment {
  cutStart: number   // camera cut start
  mouthOpen: number  // audio starts here
  mouthClose: number // audio ends here, video cuts here
  speakerIndex: number
}

function detectSceneCuts(videoPath: string): { duration: number; segments: RawCut[] } {
  const scriptPath = path.join(process.cwd(), 'scripts', 'detect_cuts.py')
  const result = execSync(`python3 "${scriptPath}" "${videoPath}"`, { encoding: 'utf8' })
  return JSON.parse(result.trim())
}

function detectMouthSegments(videoPath: string): { duration: number; segments: RawCut[] } {
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

// For each scene cut, find the mouth open/close within it using mouth segments
function refineWithMouth(cuts: RawCut[], mouthSegs: RawCut[], duration: number): RefinedSegment[] {
  return cuts.map((cut) => {
    // Find mouth segments that overlap this cut
    const overlapping = mouthSegs.filter(
      (m) => m.startTime < cut.endTime && m.endTime > cut.startTime
    )

    if (overlapping.length > 0) {
      // Use first mouth open and last mouth close within this cut
      const mouthOpen = Math.max(cut.startTime, Math.min(...overlapping.map((m) => m.startTime)))
      const mouthClose = Math.min(cut.endTime, Math.max(...overlapping.map((m) => m.endTime)))
      return {
        cutStart: cut.startTime,
        mouthOpen,
        mouthClose,
        speakerIndex: overlapping[0].speakerIndex,
      }
    }

    // No mouth detected in this cut — use cut boundaries, audio starts at cut start
    return {
      cutStart: cut.startTime,
      mouthOpen: cut.startTime,
      mouthClose: cut.endTime,
      speakerIndex: cut.speakerIndex,
    }
  })
}

export async function analyzeAndGenerateWithVision(videoPath: string): Promise<VisionAnalysis> {
  // Step 1: Detect scene cuts (camera edits define segments)
  const cutData = detectSceneCuts(videoPath)
  const { duration } = cutData
  let cuts = cutData.segments

  // Step 2: Detect mouth open/close for timing refinement
  let mouthSegs: RawCut[] = []
  try {
    const mouthData = detectMouthSegments(videoPath)
    mouthSegs = mouthData.segments
  } catch {
    // mouth detection optional — cuts alone work fine
  }

  // Fallback: if no cuts detected, use mouth segments or even spacing
  if (cuts.length < 2) {
    cuts = mouthSegs.length >= 2
      ? mouthSegs
      : Array.from({ length: 4 }, (_, i) => ({
          startTime: (duration / 4) * i,
          endTime: (duration / 4) * (i + 1) - 0.1,
          speakerIndex: i % 2,
          duration: duration / 4,
        }))
  }

  // Step 3: Refine each cut segment with mouth open/close timing
  const refined = refineWithMouth(cuts, mouthSegs, duration)

  // Step 4: Extract one frame per segment for GPT vision
  const tmpDir = path.join(path.dirname(videoPath), 'tmp_frames_' + path.basename(videoPath, path.extname(videoPath)))
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const imageMessages: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  for (let i = 0; i < refined.length; i++) {
    const seg = refined[i]
    const midpoint = (seg.mouthOpen + seg.mouthClose) / 2
    const framePath = path.join(tmpDir, `seg_${i}.jpg`)
    extractFrameAtTime(videoPath, midpoint, framePath)

    imageMessages.push({
      type: 'text',
      text: `[Clip ${i + 1}: plano ${seg.cutStart.toFixed(1)}s, boca abre ${seg.mouthOpen.toFixed(1)}s - cierra ${seg.mouthClose.toFixed(1)}s]`,
    })
    imageMessages.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frameToBase64(framePath)}`, detail: 'low' },
    })
  }

  // Step 5: GPT-4o invents Chilean parody dialogue
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Eres un doblajista paródico chileno. Tu trabajo: inventar lo que podría estar diciendo el personaje en la imagen. Sé creativo, variado y gracioso.

REGLAS:
- Cada segmento debe hablar de un TEMA DISTINTO (comida, plata, familia, deporte, política, etc.)
- Las 3 versiones de cada segmento deben ser muy diferentes entre sí
- sutil: chilenismo suave, cotidiano
- exagerado: drama total, ridículo
- absurdo: sin sentido, garabatos si aplica
- NUNCA repitas frases entre segmentos
- El texto debe calzar con la DURACIÓN del segmento (boca abre/cierra = tiempo disponible)`,
      },
      {
        role: 'user',
        content: [
          ...imageMessages,
          {
            type: 'text',
            text: `Video deportivo de ${duration.toFixed(1)}s con ${refined.length} clips.
Los timecodes YA ESTÁN DEFINIDOS — NO los cambies.
Cada texto debe calzar aproximadamente con la duración indicada (mouthOpen → mouthClose).

Responde SOLO con JSON:
{
  "segments": [
    {
      "segmentIndex": <0-based>,
      "context": "<qué se ve en la imagen>",
      "sutil": "<texto>",
      "exagerado": "<texto>",
      "absurdo": "<texto>"
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
  const gptSegments: Array<{ segmentIndex: number; context: string; sutil: string; exagerado: string; absurdo: string }> = parsed.segments || []

  // Step 6: Assign random voices
  const allVoices = await getAvailableVoices()
  const shuffledVoices = shuffle(allVoices)
  const speakerIndexes = [...new Set(refined.map((s) => s.speakerIndex))]

  const speakers: Speaker[] = speakerIndexes.map((idx, i) => {
    const voice = shuffledVoices[i % shuffledVoices.length]
    return { id: `speaker_${idx}`, label: voice?.name || `Voz ${i + 1}`, voiceId: voice?.id || '' }
  })

  const segments: Segment[] = refined.map((s, i) => ({
    id: uuidv4(),
    cutStart: s.cutStart,
    startTime: s.mouthOpen,
    endTime: s.mouthClose,
    speakerId: `speaker_${s.speakerIndex}`,
    emotion: 'absurdo',
    context: gptSegments.find((g) => g.segmentIndex === i)?.context || '',
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
