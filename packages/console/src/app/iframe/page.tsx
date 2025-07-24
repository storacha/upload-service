import { Suspense } from 'react'
import IframeHome from '@/components/IframeHome'

export default function IframePage() {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-auto min-w-0">
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <IframeHome />
        </Suspense>
      </div>
    </div>
  )
} 