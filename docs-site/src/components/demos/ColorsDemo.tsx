"use client"

import { useState } from 'react'

const tokens = [
  { key: 'hot-red', hex: '#E91315' },
  { key: 'hot-yellow', hex: '#FFC83F' },
  { key: 'hot-blue', hex: '#0176CE' },
  { key: 'gray-dark', hex: '#1d2027' },
]

export default function ColorsDemo() {
  const [current, setCurrent] = useState(tokens[2])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tokens.map((t) => (
          <button
            key={t.key}
            onClick={() => setCurrent(t)}
            className={`px-3 py-1 rounded border ${
              current.key === t.key ? 'border-hot-blue' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <span className={`inline-block w-4 h-4 rounded mr-2 bg-${t.key}`} />
            {t.key}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-md border border-gray-200 dark:border-gray-700">
        <div className={`w-full h-16 rounded mb-3 bg-${current.key}`} />
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono">{current.key}</span>
          <button
            onClick={() => navigator.clipboard.writeText(current.hex)}
            className="text-hot-blue hover:underline"
          >
            Copy {current.hex}
          </button>
        </div>
      </div>
    </div>
  )
}


