import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! })

export async function synthesizeLine(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<void> {
  const audio = await client.textToSpeech.convert(voiceId, {
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
