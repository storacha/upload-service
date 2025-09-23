"use client"

import { useEffect, useState } from 'react'

type UploadItem = { name: string; cid: string; size: number }

export default function UploadsListDemo() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      setItems([
        { name: 'photo.png', cid: 'bafyphoto0000000000', size: 345678 },
        { name: 'report.pdf', cid: 'bafyreport000000000', size: 812345 },
        { name: 'archive.zip', cid: 'bafyarchive00000000', size: 5234567 },
      ])
      setLoading(false)
    }, 400)
    return () => clearTimeout(t)
  }, [])

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-hot-blue mx-auto" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading uploads…</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((u) => (
        <div key={u.cid} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-gray-500">CID: {u.cid}</p>
            </div>
            <a
              href={`https://${u.cid}.ipfs.w3s.link`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hot-blue text-sm hover:underline"
            >
              View
            </a>
          </div>
          <p className="text-xs text-gray-500 mt-1">{(u.size / 1024).toFixed(1)} KB</p>
        </div>
      ))}
    </div>
  )
}


