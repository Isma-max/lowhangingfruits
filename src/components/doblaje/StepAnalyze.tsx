'use client'

import { useEffect, useState } from 'react'
import { DoblajeJob } from '@/lib/doblaje/types'

interface Props {
  jobId: string
  onDone: (job: DoblajeJob) => void
}

const PHASES = [
  { label: 'Analizando video con IA...', min: 0, max: 40 },
  { label: 'Detectando personajes y segmentos...', min: 40, max: 60 },
  { label: 'Generando opciones de guión paródico...', min: 60, max: 80 },
]

export default function StepAnalyze({ jobId, onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    runPipeline()
  }, [])

  async function runPipeline() {
    try {
      setProgress(5)
      const analyzeRes = await fetch('/doblaje/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (!analyzeRes.ok) throw new Error((await analyzeRes.json()).error)
      setProgress(45)
      setPhase(1)

      const generateRes = await fetch('/doblaje/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (!generateRes.ok) throw new Error((await generateRes.json()).error)
      setProgress(90)
      setPhase(2)

      const jobRes = await fetch(`/doblaje/api/job?jobId=${jobId}`)
      const job: DoblajeJob = await jobRes.json()
      setProgress(100)

      setTimeout(() => onDone(job), 400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en el análisis')
    }
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-5xl">❌</div>
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={runPipeline}
          className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="text-center py-16 space-y-8">
      <div className="text-6xl animate-pulse">🤖</div>
      <div>
        <p className="text-xl text-gray-200 font-medium mb-2">{PHASES[phase]?.label}</p>
        <p className="text-gray-500 text-sm">Esto puede tomar 30-60 segundos</p>
      </div>
      <div className="max-w-md mx-auto">
        <div className="bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-gray-500 text-sm mt-2">{progress}%</p>
      </div>
    </div>
  )
}
