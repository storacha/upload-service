'use client'

import type { MigrationPlan } from '@/hooks/useMigration'

interface CostBreakdownProps {
  plan: MigrationPlan
  onApprove: () => void
  onCancel: () => void
}

export function CostBreakdown({ plan, onApprove, onCancel }: CostBreakdownProps) {
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

  const formatUSDFC = (amount: bigint): string => {
    // USDFC has 6 decimals
    const value = Number(amount) / 1_000_000
    return `$${value.toFixed(2)} USDFC`
  }

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Migration Cost Estimate</h3>
        <p className="text-gray-600 text-sm">
          Review the costs below before proceeding with the migration.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total Uploads" value={plan.totals.uploads.toString()} />
        <SummaryCard label="Total Shards" value={plan.totals.shards.toString()} />
        <SummaryCard label="Total Size" value={formatBytes(plan.totals.bytes)} />
      </div>

      {/* Cost Breakdown */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 mb-3">Cost Summary</h4>
        <div className="space-y-2">
          <CostRow
            label="Total Lockup Required"
            value={formatUSDFC(plan.costs.summary.totalLockupUSDFC)}
          />
          <CostRow
            label="Monthly Rate (after migration)"
            value={formatUSDFC(plan.costs.summary.totalRatePerMonth)}
          />
          <CostRow
            label="Available Funds"
            value={formatUSDFC(plan.costs.summary.availableFunds)}
          />
          {plan.costs.summary.debt > 0n && (
            <CostRow
              label="Outstanding Debt"
              value={formatUSDFC(plan.costs.summary.debt)}
              variant="warning"
            />
          )}
          <div className="border-t border-gray-200 pt-2 mt-2">
            <CostRow
              label="Deposit Needed"
              value={formatUSDFC(plan.costs.totalDepositNeeded)}
              variant={plan.costs.totalDepositNeeded > 0n ? 'highlight' : 'default'}
            />
          </div>
          {plan.fundingAmount > 0n && (
            <CostRow
              label="Funding Amount (with 10% buffer)"
              value={formatUSDFC(plan.fundingAmount)}
              variant="highlight"
            />
          )}
        </div>
      </div>

      {/* Per-Space Breakdown */}
      {plan.costs.perSpace.length > 1 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Per-Space Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Space</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Size</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Lockup</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Rate/Month</th>
                </tr>
              </thead>
              <tbody>
                {plan.costs.perSpace.map((space) => (
                  <tr key={space.spaceDID} className="border-b border-gray-100">
                    <td className="py-2 px-3">
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {space.spaceDID.slice(0, 20)}...
                      </code>
                      {space.isResumed && (
                        <span className="ml-2 text-xs text-blue-600">(resumed)</span>
                      )}
                    </td>
                    <td className="text-right py-2 px-3">{formatBytes(space.bytesToMigrate)}</td>
                    <td className="text-right py-2 px-3">{formatUSDFC(space.lockupUSDFC)}</td>
                    <td className="text-right py-2 px-3">{formatUSDFC(space.ratePerMonth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {plan.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ready Status */}
      <div className={`mb-6 p-4 rounded-lg ${plan.ready ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        {plan.ready ? (
          <p className="text-green-800 text-sm">
            ✓ All prerequisites met. You can proceed with the migration.
          </p>
        ) : (
          <div className="text-yellow-800 text-sm">
            <p className="font-medium mb-1">Prerequisites not met:</p>
            <ul className="list-disc list-inside">
              {plan.costs.totalDepositNeeded > 0n && (
                <li>Deposit of {formatUSDFC(plan.fundingAmount)} required</li>
              )}
              {plan.costs.needsFwssMaxApproval && (
                <li>FWSS max approval required</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onApprove}
          className="px-6 py-3 rounded-lg font-medium text-white bg-hot-red hover:bg-red-700"
        >
          {plan.ready ? 'Start Migration' : 'Fund & Start Migration'}
        </button>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: string
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

interface CostRowProps {
  label: string
  value: string
  variant?: 'default' | 'warning' | 'highlight'
}

function CostRow({ label, value, variant = 'default' }: CostRowProps) {
  const valueClass = {
    default: 'text-gray-900',
    warning: 'text-yellow-700',
    highlight: 'text-hot-red font-semibold',
  }[variant]

  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
