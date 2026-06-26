import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { getDemoScriptOptions } from '@/lib/doblaje/demo-data'

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  const job = getJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.segments) return NextResponse.json({ error: 'No segments yet' }, { status: 400 })

  // If scriptOptions already set by vision analysis, skip generation
  if (job.scriptOptions && job.scriptOptions.length > 0) {
    updateJob(jobId, { progress: 70 })
    return NextResponse.json({ scriptOptions: job.scriptOptions })
  }

  // Demo mode fallback
  const demoOptions = getDemoScriptOptions()
  const scriptOptions = job.segments.map((seg, i) =>
    (demoOptions[i] || demoOptions[0]).map((opt) => ({ ...opt, segmentId: seg.id }))
  )
  updateJob(jobId, { progress: 70, scriptOptions })
  return NextResponse.json({ scriptOptions })
}
