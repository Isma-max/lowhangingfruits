import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { generateScriptOptions } from '@/lib/doblaje/scriptgen'

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  const job = getJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.segments || !job.speakers) return NextResponse.json({ error: 'No segments yet' }, { status: 400 })

  updateJob(jobId, { progress: 50 })

  try {
    const scriptOptions = await generateScriptOptions(job.segments, job.speakers)
    updateJob(jobId, { progress: 70, scriptOptions })
    return NextResponse.json({ scriptOptions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Script generation failed'
    updateJob(jobId, { status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
