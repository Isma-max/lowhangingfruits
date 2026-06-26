import { GoogleGenerativeAI } from '@google/generative-ai'
import { Segment, ScriptOption, Speaker } from './types'
import { v4 as uuidv4 } from 'uuid'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateScriptOptions(
  segments: Segment[],
  speakers: Speaker[]
): Promise<ScriptOption[][]> {
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const speakerMap = Object.fromEntries(speakers.map((s) => [s.id, s.label]))
  const humors: Array<'sutil' | 'exagerado' | 'absurdo'> = ['sutil', 'exagerado', 'absurdo']

  const segmentDescriptions = segments
    .map((s, i) => {
      const dur = (s.endTime - s.startTime).toFixed(1)
      return `Segmento ${i + 1} (${dur}s, ${speakerMap[s.speakerId] || 'Locutor'}, emoción: ${s.emotion}): ${s.context}`
    })
    .join('\n')

  const prompt = `Eres un escritor de doblaje paródico deportivo. Genera 3 opciones de guión para cada segmento.

REGLAS:
- Cada línea debe caber en el tiempo indicado (máximo 15 palabras por cada 3 segundos)
- El tono debe ser deportivo pero absurdo/cómico
- NUNCA uses el audio original como referencia
- Opciones: sutil (levemente cómico), exagerado (muy dramático), absurdo (completamente ridículo)
- Responde SOLO con JSON válido

Segmentos:
${segmentDescriptions}

Responde:
{
  "segments": [
    {
      "sutil": "<texto opción sutil>",
      "exagerado": "<texto opción exagerada>",
      "absurdo": "<texto opción absurda>"
    }
  ]
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(text)

  return (parsed.segments || []).map((opts: Record<string, string>, i: number) => {
    const seg = segments[i]
    if (!seg) return []
    return humors.map((humor) => ({
      id: uuidv4(),
      segmentId: seg.id,
      text: opts[humor] || '',
      humor,
    }))
  })
}
