import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { setJob } from '@/lib/doblaje/store'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'videos')
const MAX_SIZE = 100 * 1024 * 1024 // 100MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('video') as File | null

  if (!file) return NextResponse.json({ error: 'No video file' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })

  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no soportado. Usa MP4, WebM, MOV o AVI.' }, { status: 400 })
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  const jobId = uuidv4()
  const ext = file.name.split('.').pop() || 'mp4'
  const videoPath = path.join(UPLOAD_DIR, `${jobId}.${ext}`)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(videoPath, buffer)

  setJob(jobId, {
    id: jobId,
    status: 'pending',
    progress: 0,
    videoPath,
    createdAt: Date.now(),
  })

  return NextResponse.json({ jobId })
}
