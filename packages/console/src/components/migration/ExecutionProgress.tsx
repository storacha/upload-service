'use client'

import { useEffect, useState } from 'react'
import type { MigrationProgress } from '@/hooks/useMigration'

interface MigrationState {
  phase: string
  spaces: Record<string, {
    did: string
    phase: string
    committed: Record<string, true>
    failedUploads: Record<string, true>
  }>
  spacesInventories: Record<string, {
    shards: unknown[]
  }>
}

interface ExecutionProgressProps {
  progress: MigrationProgress
  state: MigrationState | null
  onStart: () => Promise<void>
}

export function ExecutionProgress({ progress, state, onStart }: ExecutionProgressProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const [isFunding, setIsFunding] = useState(false)

  useEffect(() => {
    if (progress.phase === 'executing' && !hasStarted) {
      setHasStarted(true)
    }
  }, [progress.phase, hasStarted])

  const handleStart = async () => {
    setIsFunding(true)
    try {
      await onStart()
    } finally {
      setIsFunding(false)
    }
  }

  const getSpaceProgress = () => {
    if (!state) return []
    
    return Object.entries(state.spaces).map(([did, space]) => {
      const inventory = state.spacesInventories[did]
      const totalShards = inventory?.shards?.length ?? 0
      const committedShards = Object.keys(space.committed).length
      const failedUploads = Object.keys(space.failedUploads).length
      
      return {
        did,
        phase: space.phase,
        totalShards,
        committedShards,
        failedUploads,
        percentage: totalShards > 0 ? (committedShards / totalShards) * 100 : 0,
      }
    })
  }

  if (!hasStarted) {
    return (
      <div className="text-center py-8">
        <div className="mb-6">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Migrate</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Click the button below to start the migration process.
            This will fund your account (if needed) and begin migrating your content to Filecoin.
          </p>
        </div>

        <button
          onClick={handleStart}
          disabled={isFunding}
          className={`
            px-6 py-3 rounded-lg font-medium text-white
            ${isFunding ? 'bg-gray-400 cursor-not-allowed' : 'bg-hot-red hover:bg-red-700'}
          `}
        >
          {isFunding ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Processing...
            </span>
          ) : (
            'Start Migration'
          )}
        </button>
      </div>
    )
  }

  const spaceProgress = getSpaceProgress()
  const totalCommitted = spaceProgress.reduce((n, s) => n + s.committedShards, 0)
  const totalShards = spaceProgress.reduce((n, s) => n + s.totalShards, 0)
  const overallPercentage = totalShards > 0 ? (totalCommitted / totalShards) * 100 : 0

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Migration in Progress</h3>
        <p className="text-gray-600 text-sm">
          Your content is being migrated to Filecoin. This may take a while.
        </p>
      </div>

      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Overall Progress</span>
          <span className="text-gray-900 font-medium">
            {totalCommitted} / {totalShards} shards ({overallPercentage.toFixed(1)}%)
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-hot-red transition-all duration-300"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      {/* Per-Space Progress */}
      <div className="space-y-4">
        {spaceProgress.map((space) => (
          <div key={space.did} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                {space.did.slice(0, 24)}...
              </code>
              <SpacePhaseTag phase={space.phase} />
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">
                {space.committedShards} / {space.totalShards} shards
              </span>
              {space.failedUploads > 0 && (
                <span className="text-yellow-600">
                  {space.failedUploads} failed uploads
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  space.phase === 'complete' ? 'bg-green-500' :
                  space.phase === 'failed' ? 'bg-red-500' :
                  'bg-purple-500'
                }`}
                style={{ width: `${space.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-xs text-green-600 mb-1">Committed</p>
          <p className="text-xl font-semibold text-green-700">{totalCommitted}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <p className="text-xs text-yellow-600 mb-1">Failed</p>
          <p className="text-xl font-semibold text-yellow-700">{progress.shardsFailed}</p>
        </div>
      </div>
    </div>
  )
}

interface SpacePhaseTagProps {
  phase: string
}

function SpacePhaseTag({ phase }: SpacePhaseTagProps) {
  const config = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending' },
    migrating: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Migrating' },
    complete: { bg: 'bg-green-100', text: 'text-green-600', label: 'Complete' },
    incomplete: { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'Incomplete' },
    failed: { bg: 'bg-red-100', text: 'text-red-600', label: 'Failed' },
  }[phase] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: phase }

  return (
    <span className={`text-xs px-2 py-1 rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}
