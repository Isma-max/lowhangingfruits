import { NextRequest, NextResponse } from 'next/server'
import * as path from 'path'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { synthesizeLine } from '@/lib/doblaje/tts'
import { SelectedLine } from '@/lib/doblaje/types'

export async function POST(req: NextRequest) {
  const { jobId, selectedLines }: { jobId: string; selectedLines: SelectedLine[] } = await req.json()
  const job = getJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  updateJob(jobId, { status: 'synthesizing', progress: 75, selectedLines })

  const audioDir = path.join(process.cwd(), 'uploads', 'audio', jobId)

  try {
    for (const line of selectedLines) {
      const outputPath = path.join(audioDir, `line_${line.segmentId}.mp3`)
      await synthesizeLine(line.text, line.voiceId, outputPath)
    }
    updateJob(jobId, { progress: 88 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TTS failed'
    updateJob(jobId, { status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
