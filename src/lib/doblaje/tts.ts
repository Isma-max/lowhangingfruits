import { ElevenLabsClient } from 'elevenlabs'
import * as fs from 'fs'
import * as path from 'path'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! })

export async function synthesizeLine(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<void> {
  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  })

  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const chunks: Buffer[] = []
  for await (const chunk of audio) {
    chunks.push(Buffer.from(chunk))
  }
  fs.writeFileSync(outputPath, Buffer.concat(chunks))
}
