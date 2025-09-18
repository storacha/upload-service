"use client"

import { useState } from 'react'

export function Playground({ initialCode, children }: { initialCode?: string, children?: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="not-prose border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Live Example</div>
        <button className="text-xs text-hot-blue dark:text-hot-blue-light" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="p-4 bg-white dark:bg-gray-900">
          {children ?? (
            <pre className="text-xs text-gray-400">{initialCode}</pre>
          )}
        </div>
      )}
    </div>
  )
}
