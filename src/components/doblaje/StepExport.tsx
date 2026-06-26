'use client'

import { useEffect, useState } from 'react'
import { SelectedLine } from '@/lib/doblaje/types'

interface Props {
  jobId: string
  selectedLines: SelectedLine[]
}

type Phase = 'synthesizing' | 'mixing' | 'done' | 'error'

export default function StepExport({ jobId, selectedLines }: Props) {
  const [phase, setPhase] = useState<Phase>('synthesizing')
  const [outputUrl, setOutputUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    run()
  }, [])

  async function run() {
    try {
      setPhase('synthesizing')
      const synthRes = await fetch('/doblaje/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, selectedLines }),
      })
      if (!synthRes.ok) throw new Error((await synthRes.json()).error)

      setPhase('mixing')
      const exportRes = await fetch('/doblaje/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (!exportRes.ok) throw new Error((await exportRes.json()).error)
      const { outputUrl } = await exportRes.json()

      setOutputUrl(outputUrl)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar')
      setPhase('error')
    }
  }

  if (phase === 'error') {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-5xl">❌</div>
        <p className="text-red-400 text-lg">{error}</p>
        <button onClick={run} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="text-center py-16 space-y-6">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-green-400">¡Tu doblaje está listo!</h2>
        <p className="text-gray-400">El video original no fue modificado — solo se reemplazó el audio</p>
        <a
          href={outputUrl}
          download
          className="inline-block px-10 py-4 bg-green-600 rounded-xl text-white font-bold text-lg hover:bg-green-700 transition-colors"
        >
          ⬇️ Descargar video doblado
        </a>
        <div className="pt-4">
          <button
            onClick={() => window.location.reload()}
            className="text-gray-500 hover:text-gray-300 text-sm underline"
          >
            Doblar otro video
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-16 space-y-8">
      <div className="text-6xl animate-spin">🎵</div>
      <div>
        <p className="text-xl text-gray-200 font-medium">
          {phase === 'synthesizing' ? 'Sintetizando voces con ElevenLabs...' : 'Mezclando audio con el video...'}
        </p>
        <p className="text-gray-500 text-sm mt-2">Un momento más...</p>
      </div>
      <div className="max-w-md mx-auto bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-1000"
          style={{ width: phase === 'synthesizing' ? '40%' : '85%' }}
        />
      </div>
    </div>
  )
}
