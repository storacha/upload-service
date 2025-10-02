"use client"

import { useState } from 'react'

type Progress = Record<string, number>

export default function UploadDemoMulti() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<'idle' | 'uploading' | 'succeeded'>('idle')
  const [progressByFile, setProgressByFile] = useState<Progress>({})

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : []
    setFiles(list)
    setStatus('idle')
    setProgressByFile({})
  }

  function tickFile(name: string, current: number) {
    const next = Math.min(100, current + 10 + Math.random() * 20)
    setProgressByFile((prev) => ({ ...prev, [name]: Math.round(next) }))
    return next
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return
    setStatus('uploading')
    setProgressByFile(Object.fromEntries(files.map((f) => [f.name, 0])))

    const timers: number[] = []
    await new Promise<void>((resolve) => {
      files.forEach((f, idx) => {
        const timer = window.setInterval(() => {
          const val = progressByFile[f.name] ?? 0
          const next = tickFile(f.name, val)
          if (next >= 100) {
            window.clearInterval(timer)
            timers.splice(idx, 1)
            if (timers.length === 0) {
              resolve()
            }
          }
        }, 250)
        timers.push(timer)
      })
      if (files.length === 0) resolve()
    })

    setStatus('succeeded')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="demo-files" className="block text-sm font-medium mb-1">Select Files</label>
        <input id="demo-files" type="file" multiple onChange={onChange} className="w-full" />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.name} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="truncate max-w-xs">{f.name}</span>
                <span>{progressByFile[f.name] ?? 0}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressByFile[f.name] ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={files.length === 0 || status === 'uploading'}
        className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
      >
        {status === 'uploading' ? 'Uploading…' : `Upload ${files.length} Files`}
      </button>

      {status === 'succeeded' && (
        <div className="text-sm text-green-700 dark:text-green-300">All files uploaded (simulated).</div>
      )}
    </form>
  )
}


