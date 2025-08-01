import { Suspense } from 'react'
import IframeHome from '@/components/IframeHome'
import { TopLevelLoader } from '@/components/Loader'

export default function IframePage() {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-auto min-w-0">
        <Suspense fallback={<TopLevelLoader />}>
          <IframeHome />
        </Suspense>
      </div>
    </div>
  )
} 