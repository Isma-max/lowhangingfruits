'use client'

import { useState } from 'react'
import { DoblajeJob, ScriptOption, SelectedLine } from '@/lib/doblaje/types'

interface Props {
  job: DoblajeJob
  onDone: (lines: SelectedLine[]) => void
}

const HUMOR_LABELS: Record<string, { label: string; color: string }> = {
  sutil: { label: 'Sutil', color: 'bg-green-900/50 border-green-700 text-green-300' },
  exagerado: { label: 'Exagerado', color: 'bg-yellow-900/50 border-yellow-700 text-yellow-300' },
  absurdo: { label: 'Absurdo', color: 'bg-purple-900/50 border-purple-700 text-purple-300' },
}

export default function StepScript({ job, onDone }: Props) {
  const { segments = [], speakers = [], scriptOptions = [] } = job
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [edited, setEdited] = useState<Record<string, string>>({})

  function selectOption(segmentId: string, option: ScriptOption) {
    setSelected((prev) => ({ ...prev, [segmentId]: option.id }))
    setEdited((prev) => ({ ...prev, [segmentId]: option.text }))
  }

  function allSelected() {
    return segments.every((s) => selected[s.id])
  }

  function handleConfirm() {
    const lines: SelectedLine[] = segments.map((seg) => {
      const speaker = speakers.find((sp) => sp.id === seg.speakerId)
      return {
        segmentId: seg.id,
        text: edited[seg.id] || '',
        voiceId: speaker?.voiceId || '',
        startTime: seg.startTime,
        endTime: seg.endTime,
      }
    })
    onDone(lines)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Elige tu guión</h2>
        <p className="text-gray-400 mt-1">Selecciona una opción por segmento y edítala si quieres</p>
      </div>

      {segments.map((seg, i) => {
        const options = scriptOptions[i] || []
        const speaker = speakers.find((sp) => sp.id === seg.speakerId)
        const dur = (seg.endTime - seg.startTime).toFixed(1)
        const selectedOptId = selected[seg.id]

        return (
          <div key={seg.id} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-gray-400 text-sm">Segmento {i + 1}</span>
                <span className="mx-2 text-gray-600">·</span>
                <span className="text-gray-400 text-sm">{speaker?.label || 'Locutor'}</span>
                <span className="mx-2 text-gray-600">·</span>
                <span className="text-gray-500 text-sm">{seg.startTime.toFixed(1)}s – {seg.endTime.toFixed(1)}s ({dur}s)</span>
              </div>
              <span className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-400">{seg.emotion}</span>
            </div>
            {seg.originalText && (
              <p className="text-xs text-gray-600 mb-1">Original: <span className="italic">"{seg.originalText}"</span></p>
            )}
            <p className="text-gray-500 text-sm mb-3 italic">"{seg.context}"</p>

            <div className="grid grid-cols-1 gap-2 mb-3">
              {options.map((opt) => {
                const style = HUMOR_LABELS[opt.humor]
                const isSelected = selectedOptId === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => selectOption(seg.id, opt)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      isSelected ? style.color + ' border-opacity-100' : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className={`text-xs font-bold mr-2 ${isSelected ? '' : 'text-gray-500'}`}>
                      {style?.label}
                    </span>
                    <span className={isSelected ? 'text-white' : 'text-gray-300'}>{opt.text}</span>
                  </button>
                )
              })}
            </div>

            {selectedOptId && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Editar texto seleccionado:</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
                  rows={2}
                  value={edited[seg.id] || ''}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [seg.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        )
      })}

      <div className="text-center pt-4">
        <button
          disabled={!allSelected()}
          onClick={handleConfirm}
          className="px-10 py-3 bg-blue-600 rounded-xl text-white font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          Generar voces →
        </button>
        {!allSelected() && (
          <p className="text-gray-600 text-sm mt-2">Selecciona una opción por cada segmento</p>
        )}
      </div>
    </div>
  )
}
