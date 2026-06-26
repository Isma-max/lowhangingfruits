'use client'

import { useState, useRef } from 'react'

interface Props {
  onDone: (jobId: string) => void
}

export default function StepUpload({ onDone }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('video', file)
      const res = await fetch('/doblaje/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone(data.jobId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el video')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-950/30' : 'border-gray-600 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {uploading ? (
          <div className="space-y-3">
            <div className="text-4xl animate-bounce">⬆️</div>
            <p className="text-gray-300">Subiendo video...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-6xl">🎬</div>
            <p className="text-xl text-gray-200 font-medium">Arrastra tu video aquí</p>
            <p className="text-gray-500">o haz click para seleccionarlo</p>
            <p className="text-sm text-gray-600 mt-4">MP4, WebM, MOV · máx. 100MB · 5-60 segundos</p>
          </div>
        )}
      </div>
      {error && <p className="text-red-400 text-center">{error}</p>}
    </div>
  )
}
