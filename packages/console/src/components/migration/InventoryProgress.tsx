'use client'

import { useState } from 'react'
import type { MigrationProgress } from '@/hooks/useMigration'

interface InventoryProgressProps {
  spaceDID: string
  progress: MigrationProgress
  onStart: () => Promise<void>
  onComplete: () => void
}

export function InventoryProgress({
  spaceDID,
  progress,
  onStart,
  onComplete,
}: InventoryProgressProps) {
  const [hasStarted, setHasStarted] = useState(false)

  const isComplete = progress.phase === 'planning'

  const handleStart = async () => {
    setHasStarted(true)
    await onStart()
  }

  const formatBytes = (bytes: bigint): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = Number(bytes)
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`
  }

  if (!hasStarted) {
    return (
      <div className="text-center py-8">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Scan Your Content</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            We&apos;ll scan your uploads and resolve shard information from the indexing service.
            This may take a few minutes depending on how much content you have.
          </p>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg max-w-md mx-auto">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Space:</span>{' '}
            <code className="text-xs bg-gray-200 px-1 rounded">{spaceDID}</code>
          </p>
        </div>

        <button
          onClick={handleStart}
          className="px-6 py-3 rounded-lg font-medium text-white bg-hot-red hover:bg-red-700"
        >
          Start Scanning
        </button>
      </div>
    )
  }

  return (
    <div className="py-6">
      {!isComplete && (
        <div className="flex items-center justify-center mb-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-red" />
        </div>
      )}

      <h3 className="text-lg font-medium text-gray-900 text-center mb-6">
        {isComplete ? 'Scan Complete!' : 'Scanning Content...'}
      </h3>

      <div className="max-w-md mx-auto space-y-4">
        <ProgressItem
          label="Spaces"
          current={progress.spacesCompleted}
          total={progress.spacesTotal}
        />

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Uploads Found" value={progress.uploadsFound.toString()} />
          <StatCard label="Shards Resolved" value={progress.shardsResolved.toString()} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total Size" value={formatBytes(progress.bytesTotal)} />
          <StatCard
            label="Failed Shards"
            value={progress.shardsFailed.toString()}
            variant={progress.shardsFailed > 0 ? 'warning' : 'default'}
          />
        </div>

        {progress.currentSpace && !isComplete && (
          <div className="text-center text-sm text-gray-500">
            Currently scanning:{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">
              {progress.currentSpace.slice(0, 20)}...
            </code>
          </div>
        )}

        {isComplete && (
          <div className="text-center mt-6">
            {progress.shardsResolved === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-800 font-medium">No content available for migration</p>
                {progress.shardsFailed > 0 ? (
                  <p className="text-yellow-700 text-sm mt-1">
                    {progress.shardsFailed} shard(s) failed to resolve. This usually means the content 
                    was uploaded before piece CID tracking was available, or the indexing service 
                    doesn&apos;t have claims for this content yet.
                  </p>
                ) : (
                  <p className="text-yellow-700 text-sm mt-1">
                    This space has no uploads. Upload some content first, then try again.
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={onComplete}
                className="px-6 py-3 rounded-lg font-medium text-white bg-hot-red hover:bg-red-700"
              >
                Continue to Cost Calculation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ProgressItemProps {
  label: string
  current: number
  total: number
}

function ProgressItem({ label, current, total }: ProgressItemProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">
          {current} / {total}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-hot-red transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  variant?: 'default' | 'warning'
}

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  return (
    <div className={`p-3 rounded-lg ${variant === 'warning' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${variant === 'warning' ? 'text-yellow-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
