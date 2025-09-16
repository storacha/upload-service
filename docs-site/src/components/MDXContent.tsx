'use client'

import { ReactNode } from 'react'

interface MDXContentProps {
  children: ReactNode
}

export function MDXContent({ children }: MDXContentProps) {
  return (
    <div className="prose prose-lg max-w-none">
      {children}
    </div>
  )
}
