import { NextRequest, NextResponse } from 'next/server'
import * as path from 'path'
import * as fs from 'fs'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return new NextResponse('Missing jobId', { status: 400 })

  const outputPath = path.join(process.cwd(), 'uploads', 'output', `${jobId}_doblado.mp4`)

  if (!fs.existsSync(outputPath)) {
    return new NextResponse(`File not found at ${outputPath}`, { status: 404 })
  }

  const buffer = fs.readFileSync(outputPath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="doblado.mp4"`,
      'Content-Length': buffer.length.toString(),
    },
  })
}
