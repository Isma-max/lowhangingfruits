import { NextRequest, NextResponse } from 'next/server'
import * as path from 'path'
import * as fs from 'fs'
import { getJob, updateJob } from '@/lib/doblaje/store'
import { mixAndExport } from '@/lib/doblaje/mixer'

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  const job = getJob(jobId)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.videoPath || !job.selectedLines) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  updateJob(jobId, { status: 'mixing', progress: 90 })

  const audioDir = path.join(process.cwd(), 'uploads', 'audio', jobId)
  const outputDir = path.join(process.cwd(), 'uploads', 'output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, `${jobId}_doblado.mp4`)

  try {
    await mixAndExport(job.videoPath, job.selectedLines, audioDir, outputPath)
    updateJob(jobId, {
      status: 'done',
      progress: 100,
      outputUrl: `/doblaje/api/export/download?jobId=${jobId}`,
    })
    return NextResponse.json({ outputUrl: `/doblaje/api/export/download?jobId=${jobId}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    updateJob(jobId, { status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return new NextResponse('Missing jobId', { status: 400 })

  const outputPath = path.join(process.cwd(), 'uploads', 'output', `${jobId}_doblado.mp4`)
  if (!fs.existsSync(outputPath)) return new NextResponse('File not found', { status: 404 })

  const buffer = fs.readFileSync(outputPath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="doblado_${jobId}.mp4"`,
      'Content-Length': buffer.length.toString(),
    },
  })
}
