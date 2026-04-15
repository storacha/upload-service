'use client'

interface MigrationState {
  phase: string
  spaces: Record<string, {
    did: string
    phase: string
    committed: Record<string, true>
    failedUploads: Record<string, true>
    dataSetId: bigint | null
  }>
  spacesInventories: Record<string, {
    shards: unknown[]
    uploads: string[]
    failedUploads: string[]
  }>
}

interface MigrationCompleteProps {
  state: MigrationState
  onReset: () => void
}

export function MigrationComplete({ state, onReset }: MigrationCompleteProps) {
  const spaces = Object.entries(state.spaces)
  const totalCommitted = spaces.reduce((n, [, s]) => n + Object.keys(s.committed).length, 0)
  const totalShards = Object.values(state.spacesInventories).reduce(
    (n, inv) => n + (inv.shards?.length ?? 0),
    0
  )
  const totalFailed = totalShards - totalCommitted
  const successRate = totalShards > 0 ? (totalCommitted / totalShards) * 100 : 0

  const isComplete = state.phase === 'complete'
  const isIncomplete = state.phase === 'incomplete'

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isComplete ? 'bg-green-100' : 'bg-yellow-100'
        }`}>
          {isComplete ? (
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isComplete ? 'Migration Complete!' : 'Migration Finished with Issues'}
        </h3>
        <p className="text-gray-600 text-sm">
          {isComplete
            ? 'All your content has been successfully migrated to Filecoin.'
            : 'Some shards could not be migrated. You can retry the migration later.'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-xs text-green-600 mb-1">Committed</p>
          <p className="text-2xl font-semibold text-green-700">{totalCommitted}</p>
        </div>
        <div className={`rounded-lg p-4 text-center ${totalFailed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <p className={`text-xs mb-1 ${totalFailed > 0 ? 'text-red-600' : 'text-gray-500'}`}>Failed</p>
          <p className={`text-2xl font-semibold ${totalFailed > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {totalFailed}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-xs text-blue-600 mb-1">Success Rate</p>
          <p className="text-2xl font-semibold text-blue-700">{successRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Per-Space Results */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">Space Results</h4>
        <div className="space-y-3">
          {spaces.map(([did, space]) => {
            const inventory = state.spacesInventories[did]
            const committed = Object.keys(space.committed).length
            const total = inventory?.shards?.length ?? 0
            const failed = Object.keys(space.failedUploads).length

            return (
              <div key={did} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                    {did.slice(0, 24)}...
                  </code>
                  <SpaceResultTag phase={space.phase} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Shards:</span>{' '}
                    <span className="font-medium">{committed}/{total}</span>
                  </div>
                  {failed > 0 && (
                    <div>
                      <span className="text-gray-500">Failed Uploads:</span>{' '}
                      <span className="font-medium text-red-600">{failed}</span>
                    </div>
                  )}
                  {space.dataSetId && (
                    <div>
                      <span className="text-gray-500">Dataset ID:</span>{' '}
                      <span className="font-medium">{space.dataSetId.toString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {isIncomplete && (
          <button
            onClick={onReset}
            className="px-6 py-3 rounded-lg font-medium text-white bg-hot-red hover:bg-red-700"
          >
            Retry Migration
          </button>
        )}
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          Back to Space
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="font-medium text-blue-800 mb-1">What&apos;s Next?</h5>
        <p className="text-sm text-blue-700">
          Your content is now stored on Filecoin through a storage provider.
          The data will be available for retrieval through the Filecoin network.
          You can continue to access your content through Storacha as usual.
        </p>
      </div>
    </div>
  )
}

interface SpaceResultTagProps {
  phase: string
}

function SpaceResultTag({ phase }: SpaceResultTagProps) {
  const config = {
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
