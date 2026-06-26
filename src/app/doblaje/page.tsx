'use client'

import { useState } from 'react'
import StepUpload from '@/components/doblaje/StepUpload'
import StepAnalyze from '@/components/doblaje/StepAnalyze'
import StepScript from '@/components/doblaje/StepScript'
import StepExport from '@/components/doblaje/StepExport'
import { DoblajeJob, SelectedLine } from '@/lib/doblaje/types'

type Step = 'upload' | 'analyze' | 'script' | 'export'

export default function DoblajePage() {
  const [step, setStep] = useState<Step>('upload')
  const [jobId, setJobId] = useState<string>('')
  const [job, setJob] = useState<DoblajeJob | null>(null)
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Doblaje Deportivo IA</h1>
          <p className="text-gray-400">Transforma clips deportivos en doblaje paródico con IA</p>
        </div>

        <StepIndicator current={step} />

        <div className="mt-8">
          {step === 'upload' && (
            <StepUpload
              onDone={(id) => {
                setJobId(id)
                setStep('analyze')
              }}
            />
          )}
          {step === 'analyze' && (
            <StepAnalyze
              jobId={jobId}
              onDone={(updatedJob) => {
                setJob(updatedJob)
                setStep('script')
              }}
            />
          )}
          {step === 'script' && job && (
            <StepScript
              job={job}
              onDone={(lines) => {
                setSelectedLines(lines)
                setStep('export')
              }}
            />
          )}
          {step === 'export' && (
            <StepExport jobId={jobId} selectedLines={selectedLines} />
          )}
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { id: 'upload', label: 'Subir video' },
  { id: 'analyze', label: 'Analizar' },
  { id: 'script', label: 'Guión' },
  { id: 'export', label: 'Exportar' },
] as const

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                i < currentIdx
                  ? 'bg-green-500 border-green-500 text-white'
                  : i === currentIdx
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-500'
              }`}
            >
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span className={`text-xs ${i === currentIdx ? 'text-blue-400' : 'text-gray-500'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-16 h-0.5 mb-4 mx-1 ${i < currentIdx ? 'bg-green-500' : 'bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
