"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const REPO_BASE = 'https://github.com/storacha/upload-service/edit/feat/docs/docs-site/src/app'

export function EditThisPage() {
  const pathname = usePathname()
  const filePath = pathname.endsWith('/') ? `${pathname}page.tsx` : `${pathname}/page.tsx`
  const href = `${REPO_BASE}${filePath}`

  return (
    <div className="mt-8 text-right">
      <Link
        href={href}
        target="_blank"
        className="text-sm text-gray-400 hover:text-hot-blue"
      >
        Edit this page on GitHub
      </Link>
    </div>
  )
}



