import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { transcribeVideo } from '@/lib/doblaje/whisper'
import { getDemoAnalysis } from '@/lib/doblaje/demo-data'
import { v4 as uuidv4 } from 'uuid'

const DEMO_MODE = process.env.OPENAI_API_KEY === 'demo' || !process.env.OPENAI_API_KEY

const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Narrador' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Comentarista' },
]

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
        progress: 40,
        duration: analysis.duration,
        speakers: analysis.speakers,
        segments: analysis.segments,
      })
      return NextResponse.json({ speakers: analysis.speakers, segments: analysis.segments })
    }

    const transcribedSegments = await transcribeVideo(job.videoPath)

    updateJob(jobId, { progress: 30 })

    const speakers = [
      { id: 'speaker_0', label: ELEVENLABS_VOICES[0].label, voiceId: ELEVENLABS_VOICES[0].id },
      { id: 'speaker_1', label: ELEVENLABS_VOICES[1].label, voiceId: ELEVENLABS_VOICES[1].id },
    ]

    const segments = transcribedSegments.map((seg, i) => ({
      id: seg.id || uuidv4(),
      startTime: seg.start,
      endTime: seg.end,
      speakerId: `speaker_${i % 2}`,
      emotion: 'narrando',
      context: seg.text,
      originalText: seg.text,
    }))

    const duration = segments.length > 0 ? segments[segments.length - 1].endTime : 30

    updateJob(jobId, {
      status: 'generating',
      progress: 40,
      duration,
      speakers,
      segments,
    })

    return NextResponse.json({ speakers, segments })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    updateJob(jobId, { status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
