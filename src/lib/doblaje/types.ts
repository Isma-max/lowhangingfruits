export type JobStatus = 'pending' | 'analyzing' | 'generating' | 'synthesizing' | 'mixing' | 'done' | 'error'

export interface Speaker {
  id: string
  label: string
  voiceId: string
}

export interface Segment {
  id: string
  cutStart: number   // when the camera cut happens (video clip start)
  startTime: number  // when the mouth opens (audio starts here)
  endTime: number    // when the mouth closes (audio ends, video cuts to next)
  speakerId: string
  emotion: string
  context: string
  originalText?: string
}

export interface ScriptOption {
  id: string
  segmentId: string
  text: string
  humor: 'sutil' | 'exagerado' | 'absurdo'
}

export interface SelectedLine {
  segmentId: string
  text: string
  voiceId: string
  startTime: number
  endTime: number
}

export interface DoblajeJob {
  id: string
  status: JobStatus
  progress: number
  videoPath?: string
  videoUrl?: string
  duration?: number
  speakers?: Speaker[]
  segments?: Segment[]
  scriptOptions?: ScriptOption[][]
  selectedLines?: SelectedLine[]
  outputUrl?: string
  error?: string
  createdAt: number
}
