"use client"

import { useTheme } from 'next-themes'

export default function ThemingDemo() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = (resolvedTheme ?? theme) === 'dark'

  return (
    <div className="flex items-center justify-between p-4 rounded-md border border-gray-200 dark:border-gray-700">
      <div>
        <div className="text-sm">Current theme</div>
        <div className="font-semibold">{isDark ? 'dark' : 'light'}</div>
      </div>
      <button
        className="px-3 py-2 bg-hot-blue text-white rounded-md"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        Toggle Theme
      </button>
    </div>
  )
}


