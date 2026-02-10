"use client"

import { useState } from 'react'

export function Playground({ initialCode, children }: { initialCode?: string, children?: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<'live' | 'code'>(children ? 'live' : 'code')
  return (
    <div className="not-prose border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {children && (
            <button
              className={`text-xs px-2 py-1 rounded ${tab === 'live' ? 'bg-hot-blue text-white' : 'text-gray-700 dark:text-gray-300'}`}
              onClick={() => setTab('live')}
            >
              Live
            </button>
          )}
          <button
            className={`text-xs px-2 py-1 rounded ${tab === 'code' ? 'bg-hot-blue text-white' : 'text-gray-700 dark:text-gray-300'}`}
            onClick={() => setTab('code')}
          >
            Code
          </button>
        </div>
        <button className="text-xs text-hot-blue dark:text-hot-blue-light" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="p-4 bg-white dark:bg-gray-900">
          {tab === 'live' && children}
          {tab === 'code' && (
            <pre className="text-xs text-gray-400">{initialCode}</pre>
          )}
        </div>
      )}
    </div>
  )
}
