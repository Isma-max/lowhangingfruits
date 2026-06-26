import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { analyzeAndGenerateWithVision } from '@/lib/doblaje/vision'
import { getDemoAnalysis } from '@/lib/doblaje/demo-data'

const DEMO_MODE = process.env.OPENAI_API_KEY === 'demo' || !process.env.OPENAI_API_KEY

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  const job = getJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.videoPath) return NextResponse.json({ error: 'No video path' }, { status: 400 })

  updateJob(jobId, { status: 'analyzing', progress: 10 })

  try {
    if (DEMO_MODE) {
      const analysis = getDemoAnalysis()
      updateJob(jobId, {
        status: 'generating',
        progress: 70,
        duration: analysis.duration,
        speakers: analysis.speakers,
        segments: analysis.segments,
      })
      return NextResponse.json({ speakers: analysis.speakers, segments: analysis.segments })
    }

    updateJob(jobId, { progress: 20 })
    const result = await analyzeAndGenerateWithVision(job.videoPath)

    updateJob(jobId, {
      status: 'generating',
      progress: 70,
      duration: result.duration,
      speakers: result.speakers,
      segments: result.segments,
      scriptOptions: result.scriptOptions,
    })

    return NextResponse.json({ speakers: result.speakers, segments: result.segments })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    updateJob(jobId, { status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
