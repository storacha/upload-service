import Link from 'next/link'

export function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <div className="w-8 h-8 bg-gradient-to-br from-hot-blue to-hot-red rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">CT</span>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-gray-900 dark:text-white text-sm">Console Toolkit</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">Documentation</span>
      </div>
    </Link>
  )
}
