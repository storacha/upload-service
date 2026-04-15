'use client'

import { useCallback, useState } from 'react'
import { useMigration, MigrationStep } from '@/hooks/useMigration'
import { WalletConnector } from './WalletConnector'
import { InventoryProgress } from './InventoryProgress'
import { CostBreakdown } from './CostBreakdown'
import { ExecutionProgress } from './ExecutionProgress'
import { MigrationComplete } from './MigrationComplete'

interface MigrationWizardProps {
  spaceDID?: string
  spaceDIDs?: `did:key:${string}`[]
  /** Custom roundabout URL for source URL resolution */
  roundaboutURL?: string
}

export function MigrationWizard({ spaceDID, spaceDIDs, roundaboutURL }: MigrationWizardProps) {
  const resolvedSpaceDIDs = spaceDIDs ?? (spaceDID ? [spaceDID as `did:key:${string}`] : [])
  const [isPlanning, setIsPlanning] = useState(false)
  
  const {
    step,
    setStep,
    setWalletClient,
    state,
    plan,
    progress,
    error,
    runInventory,
    runPlanner,
    runMigration,
    reset,
  } = useMigration({ spaceDIDs: resolvedSpaceDIDs, roundaboutURL })

  const handleWalletConnected = useCallback((client: any) => {
    setWalletClient(client)
    setStep('inventory')
  }, [setWalletClient, setStep])

  const handleInventoryComplete = useCallback(() => {
    setStep('planning')
  }, [setStep])

  const handleApprove = useCallback(() => {
    setStep('executing')
  }, [setStep])

  const handleCancel = useCallback(() => {
    reset()
    setIsPlanning(false)
  }, [reset])

  const handleStartPlanning = useCallback(async () => {
    setIsPlanning(true)
    await runPlanner()
    setIsPlanning(false)
  }, [runPlanner])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <StepIndicator currentStep={step} />
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error.message}</p>
        </div>
      )}

      {step === 'connect' && (
        <WalletConnector onConnected={handleWalletConnected} />
      )}

      {step === 'inventory' && (
        <InventoryProgress
          spaceDID={spaceDID}
          progress={progress}
          onStart={runInventory}
          onComplete={handleInventoryComplete}
        />
      )}

      {step === 'planning' && (
        <div className="text-center py-8">
          {isPlanning ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-red mx-auto mb-4" />
              <p className="text-gray-600">Calculating migration costs...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Calculate Migration Costs</h3>
              <p className="text-gray-600 mb-4">
                We'll connect to Filecoin to calculate storage costs for your content.
              </p>
              <button
                onClick={handleStartPlanning}
                className="px-6 py-2 bg-hot-red text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Calculate Costs
              </button>
            </>
          )}
        </div>
      )}

      {step === 'approval' && plan && (
        <CostBreakdown
          plan={plan}
          onApprove={handleApprove}
          onCancel={handleCancel}
        />
      )}

      {step === 'executing' && (
        <ExecutionProgress
          progress={progress}
          state={state}
          onStart={runMigration}
        />
      )}

      {step === 'complete' && state && (
        <MigrationComplete state={state} onReset={reset} />
      )}
    </div>
  )
}

interface StepIndicatorProps {
  currentStep: MigrationStep
}

const steps: { key: MigrationStep; label: string }[] = [
  { key: 'connect', label: 'Connect' },
  { key: 'inventory', label: 'Scan' },
  { key: 'planning', label: 'Calculate' },
  { key: 'approval', label: 'Review' },
  { key: 'executing', label: 'Migrate' },
  { key: 'complete', label: 'Done' },
]

function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="mb-8">
      <div className="flex items-center">
        {steps.map((step, index) => (
          <div key={step.key} className="flex-1 flex flex-col items-center relative">
            {/* Connector line */}
            {index > 0 && (
              <div
                className={`absolute top-4 right-1/2 w-full h-0.5 -z-10 ${
                  index <= currentIndex ? 'bg-hot-red' : 'bg-gray-200'
                }`}
              />
            )}
            {/* Step circle */}
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all
                ${index < currentIndex
                  ? 'bg-hot-red border-hot-red text-white'
                  : index === currentIndex
                  ? 'bg-white border-hot-red text-hot-red'
                  : 'bg-white border-gray-300 text-gray-400'
                }
              `}
            >
              {index < currentIndex ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            {/* Step label */}
            <span
              className={`mt-2 text-xs font-medium ${
                index <= currentIndex ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
