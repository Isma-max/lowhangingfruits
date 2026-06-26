import OpenAI from 'openai'
import { TranscribedSegment } from './whisper'
import { v4 as uuidv4 } from 'uuid'
import { ScriptOption } from './types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function rewriteWithPhonetics(
  segments: TranscribedSegment[]
): Promise<ScriptOption[][]> {
  const segmentList = segments
    .map((s, i) => `Segmento ${i + 1} (${s.start.toFixed(1)}s-${s.end.toFixed(1)}s, ${(s.end - s.start).toFixed(1)}s): "${s.text}"`)
    .join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Eres un escritor de doblaje paródico deportivo experto en fonética.
Tu tarea es reescribir frases originales como doblaje cómico, manteniendo:
1. La misma duración aproximada (misma cantidad de sílabas)
2. Fonética similar — las vocales y consonantes deben parecerse para que los labios coincidan
3. El contexto deportivo pero absurdo/cómico
4. El texto DEBE caber en el tiempo indicado (máx ~3 palabras por segundo)

Responde SOLO con JSON válido.`,
      },
      {
        role: 'user',
        content: `Reescribe estos segmentos de audio de un video de fútbol americano.
Para cada segmento genera 3 versiones: sutil, exagerado, absurdo.
La fonética debe ser similar al original para que los labios coincidan.

${segmentList}

Responde:
{
  "segments": [
    {
      "original": "<texto original>",
      "sutil": "<versión sutil con fonética similar>",
      "exagerado": "<versión exagerada con fonética similar>",
      "absurdo": "<versión absurda con fonética similar>"
    }
  ]
}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(response.choices[0].message.content || '{}')

  return (parsed.segments || []).map((opts: Record<string, string>, i: number) => {
    const seg = segments[i]
    if (!seg) return []
    const humors = ['sutil', 'exagerado', 'absurdo'] as const
    return humors.map((humor) => ({
      id: uuidv4(),
      segmentId: seg.id,
      text: opts[humor] || opts['sutil'] || '',
      humor,
    }))
  })
}
