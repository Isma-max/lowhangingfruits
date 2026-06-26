import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! })

// Fetch available voices and pick the first two
let cachedVoices: { id: string; name: string }[] = []

export async function getAvailableVoices(): Promise<{ id: string; name: string }[]> {
  if (cachedVoices.length > 0) return cachedVoices
  const response = await client.voices.getAll()
  cachedVoices = (response.voices || []).map((v) => ({
    id: v.voiceId,
    name: v.name || 'Voice',
  }))
  return cachedVoices
}

export async function synthesizeLine(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<void> {
  // Fallback to first available voice if the requested one might not exist
  let useVoiceId = voiceId
  try {
    const voices = await getAvailableVoices()
    if (voices.length > 0 && !voices.find((v) => v.id === voiceId)) {
      useVoiceId = voices[0].id
    }
  } catch {
    // keep original voiceId
  }

  const audio = await client.textToSpeech.convert(useVoiceId, {
    text,
    modelId: 'eleven_multilingual_v2',
    voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
  })

  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const nodeStream = Readable.fromWeb(audio as Parameters<typeof Readable.fromWeb>[0])
  const chunks: Buffer[] = []
  for await (const chunk of nodeStream) {
    chunks.push(Buffer.from(chunk))
  }
  fs.writeFileSync(outputPath, Buffer.concat(chunks))
}
