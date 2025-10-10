"use client"

import { useRef, useState } from 'react'

export default function UploadDemoSingle() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'succeeded' | 'failed'>('idle')
  const [progress, setProgress] = useState(0)
  const [cid, setCid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setStatus('idle')
    setProgress(0)
    setCid(null)
    setError(null)
  }

  function fakeCID(name: string) {
    const base = btoa(name + Date.now()).replace(/[^a-z0-9]/gi, '').toLowerCase()
    return `bafy${base.slice(0, 20)}`
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setStatus('uploading')
    setProgress(0)
    setError(null)

    let pct = 0
    const timer = setInterval(() => {
      pct = Math.min(100, pct + Math.random() * 20)
      setProgress(Math.round(pct))
      if (pct >= 100) {
        clearInterval(timer)
        // simulate slight delay
        setTimeout(() => {
          setStatus('succeeded')
          setCid(fakeCID(file.name))
        }, 250)
      }
    }, 250)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="demo-file" className="block text-sm font-medium mb-1">Choose File</label>
        <input
          id="demo-file"
          ref={fileInputRef}
          type="file"
          onChange={onFileChange}
          className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-hot-blue file:text-white hover:file:bg-hot-blue/90"
        />
      </div>

      {file && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
          <div className="flex justify-between">
            <span className="font-medium">{file.name}</span>
            <span className="text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      )}

      {status === 'uploading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {status === 'succeeded' && cid && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-700 dark:text-green-300 font-medium">Upload Successful!</span>
            <span>CID:</span>
            <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{cid}</code>
          </div>
        </div>
      )}

      {status === 'failed' && error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || status === 'uploading'}
        className="w-full bg-hot-blue hover:bg-hot-blue/90 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
      >
        {status === 'uploading' ? 'Uploading…' : 'Upload File'}
      </button>
    </form>
  )
}


