'use client'

import { MoonIcon } from '@heroicons/react/24/outline'

export function ThemeToggle() {
  return (
    <button
      onClick={() => alert('Theme switching coming soon!')}
      className="rounded-md p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800"
      aria-label="Toggle theme"
    >
      <MoonIcon className="h-5 w-5" />
    </button>
  )
}
