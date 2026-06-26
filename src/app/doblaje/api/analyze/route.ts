import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { analyzeVideo } from '@/lib/doblaje/gemini'
import { getDemoAnalysis } from '@/lib/doblaje/demo-data'

const DEMO_MODE = process.env.GEMINI_API_KEY === 'demo' || !process.env.GEMINI_API_KEY

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  const job = getJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.videoPath) return NextResponse.json({ error: 'No video path' }, { status: 400 })

  updateJob(jobId, { status: 'analyzing', progress: 10 })

  try {
    const analysis = DEMO_MODE ? getDemoAnalysis() : await analyzeVideo(job.videoPath)

    updateJob(jobId, {
      status: 'generating',
      progress: 40,
      duration: analysis.duration,
      speakers: analysis.speakers,
      segments: analysis.segments,
    })
    return NextResponse.json({ speakers: analysis.speakers, segments: analysis.segments })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    updateJob(jobId, { status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
