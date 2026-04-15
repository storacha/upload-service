import { useState, useCallback, useRef } from 'react'
import type { WalletClient } from 'viem'
import { useW3 } from '@storacha/ui-react'

// Types from @storacha/filecoin-pin-migration - inline to avoid build dependency
export type SpaceDID = `did:key:${string}`

export interface SpaceInventory {
  did: SpaceDID
  uploads: string[]
  shards: Array<{
    root: string
    cid: string
    pieceCID: string
    sourceURL: string
    sizeBytes: bigint
  }>
  failedUploads: string[]
  totalBytes: bigint
}

export interface MigrationState {
  phase: string
  spaces: Record<SpaceDID, {
    did: SpaceDID
    phase: string
    providerId: bigint
    serviceProvider: `0x${string}`
    dataSetId: bigint | null
    committed: Record<string, true>
    failedUploads: Record<string, true>
  }>
  spacesInventories: Record<SpaceDID, SpaceInventory>
  readerProgressCursors?: Record<SpaceDID, string>
}

export interface MigrationPlan {
  totals: {
    uploads: number
    shards: number
    bytes: bigint
  }
  costs: {
    perSpace: Array<{
      spaceDID: SpaceDID
      providerId: bigint
      serviceProvider: `0x${string}`
      dataSetId: bigint | null
      isResumed: boolean
      bytesToMigrate: bigint
      currentDataSetSize: bigint
      lockupUSDFC: bigint
      sybilFee: bigint
      rateLockupDelta: bigint
      ratePerEpoch: bigint
      ratePerMonth: bigint
    }>
    summary: {
      totalBytes: bigint
      totalLockupUSDFC: bigint
      totalRatePerEpoch: bigint
      totalRatePerMonth: bigint
      debt: bigint
      runway: bigint
      buffer: bigint
      availableFunds: bigint
      skipBufferApplied: boolean
      resumedSpaces: number
    }
    totalDepositNeeded: bigint
    needsFwssMaxApproval: boolean
    ready: boolean
    warnings: string[]
  }
  warnings: string[]
  ready: boolean
  fundingAmount: bigint
}

export interface MigrationEvent {
  type: string
  spaceDID?: SpaceDID
  root?: string
  shard?: string
  reason?: string
  error?: Error
  state?: MigrationState
  plan?: MigrationPlan
  amount?: bigint
  summary?: {
    succeeded: number
    failed: number
    skippedUploads: number
    dataSetIds: bigint[]
    totalBytes: bigint
    duration: number
  }
}

export type MigrationStep =
  | 'connect'
  | 'inventory'
  | 'planning'
  | 'approval'
  | 'executing'
  | 'complete'

export interface MigrationProgress {
  phase: 'idle' | 'reading' | 'planning' | 'executing'
  spacesTotal: number
  spacesCompleted: number
  uploadsFound: number
  shardsResolved: number
  shardsFailed: number
  bytesTotal: bigint
  currentSpace?: string
}

interface UseMigrationOptions {
  spaceDIDs?: SpaceDID[]
  /** Custom roundabout URL for source URL resolution */
  roundaboutURL?: string
}

interface UseMigrationResult {
  step: MigrationStep
  setStep: (step: MigrationStep) => void
  walletClient: WalletClient | null
  setWalletClient: (client: WalletClient | null) => void
  state: MigrationState | null
  plan: MigrationPlan | null
  progress: MigrationProgress
  error: Error | null
  runInventory: () => Promise<void>
  runPlanner: () => Promise<void>
  runMigration: () => Promise<void>
  reset: () => void
}

const STORAGE_KEY_PREFIX = 'migration:'

function getStorageKey(spaceDIDs: SpaceDID[]): string {
  if (spaceDIDs.length === 1) {
    return `${STORAGE_KEY_PREFIX}${spaceDIDs[0]}`
  }
  return `${STORAGE_KEY_PREFIX}all`
}

async function loadPersistedState(spaceDIDs: SpaceDID[]): Promise<MigrationState | null> {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(spaceDIDs)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { deserializeState } = await import('@storacha/filecoin-pin-migration')
    return deserializeState(JSON.parse(raw)) as MigrationState
  } catch {
    return null
  }
}

async function persistState(spaceDIDs: SpaceDID[], state: MigrationState): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(spaceDIDs)
    const { serializeState } = await import('@storacha/filecoin-pin-migration')
    localStorage.setItem(key, JSON.stringify(serializeState(state as any)))
  } catch {
    console.warn('Failed to persist migration state')
  }
}

function clearPersistedState(spaceDIDs: SpaceDID[]): void {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(spaceDIDs)
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const initialProgress: MigrationProgress = {
  phase: 'idle',
  spacesTotal: 0,
  spacesCompleted: 0,
  uploadsFound: 0,
  shardsResolved: 0,
  shardsFailed: 0,
  bytesTotal: 0n,
}

export function useMigration(options: UseMigrationOptions = {}): UseMigrationResult {
  const [{ client, spaces }] = useW3()
  const spaceDIDs = options.spaceDIDs ?? spaces.map(s => s.did() as SpaceDID)
  const roundaboutURL = options.roundaboutURL ?? 'https://me9dd2ztdj.execute-api.us-west-2.amazonaws.com'

  const [step, setStep] = useState<MigrationStep>('connect')
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)
  const [state, setState] = useState<MigrationState | null>(null)
  const [plan, setPlan] = useState<MigrationPlan | null>(null)
  const [progress, setProgress] = useState<MigrationProgress>(initialProgress)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const synapseRef = useRef<any>(null)

  // Load persisted state on mount
  useState(() => {
    if (!isInitialized) {
      loadPersistedState(spaceDIDs).then(loaded => {
        if (loaded) setState(loaded)
        setIsInitialized(true)
      })
    }
  })

  const handleEvent = useCallback((event: MigrationEvent) => {
    if (!event || !event.type) return
    
    switch (event.type) {
      case 'reader:space:start':
        setProgress(p => ({
          ...p,
          currentSpace: event.spaceDID,
        }))
        break

      case 'reader:space:complete':
        setProgress(p => ({
          ...p,
          spacesCompleted: p.spacesCompleted + 1,
          currentSpace: undefined,
        }))
        break

      case 'reader:shard:failed':
        setProgress(p => ({
          ...p,
          shardsFailed: p.shardsFailed + 1,
        }))
        break

      case 'state:checkpoint':
        if (event.state) {
          setState(event.state)
          persistState(spaceDIDs, event.state)
          // Update progress from state
          const inventories = Object.values(event.state.spacesInventories) as SpaceInventory[]
          setProgress(p => ({
            ...p,
            uploadsFound: inventories.reduce((n, inv) => n + inv.uploads.length, 0),
            shardsResolved: inventories.reduce((n, inv) => n + inv.shards.length, 0),
            bytesTotal: inventories.reduce((n, inv) => n + inv.totalBytes, 0n),
          }))
        }
        break

      case 'reader:complete':
        setProgress(p => ({ ...p, phase: 'planning' }))
        break

      case 'plan:ready':
        if (event.plan) {
          setPlan(event.plan)
        }
        break

      case 'funding:start':
        // Could show funding progress
        break

      case 'funding:complete':
        // Funding done
        break

      case 'funding:failed':
        if (event.error) {
          setError(event.error)
        }
        break

      case 'shard:failed':
        setProgress(p => ({
          ...p,
          shardsFailed: p.shardsFailed + 1,
        }))
        break

      case 'migration:complete':
        setStep('complete')
        setProgress(p => ({ ...p, phase: 'idle' }))
        break
    }
  }, [spaceDIDs])

  const runInventory = useCallback(async () => {
    if (!client) {
      setError(new Error('Client not available'))
      return
    }

    setError(null)
    // Clear any persisted state to ensure fresh scan
    clearPersistedState(spaceDIDs)
    setProgress({
      ...initialProgress,
      phase: 'reading',
      spacesTotal: spaceDIDs.length,
    })

    try {
      const { createInitialState, RoundaboutResolver, buildMigrationInventories } = 
        await import('@storacha/filecoin-pin-migration')
      
      // Always create fresh state for a new scan to avoid skipping spaces
      // that were partially scanned before
      const migrationState = createInitialState()
      setState(migrationState as MigrationState)

      const resolver = new RoundaboutResolver(roundaboutURL)

      console.log('Starting inventory scan for spaces:', spaceDIDs, 'roundaboutURL:', roundaboutURL)
      let eventCount = 0
      
      for await (const event of buildMigrationInventories({
        client: client as any,
        resolver,
        state: migrationState,
        spaceDIDs: spaceDIDs as any,
      })) {
        eventCount++
        console.log('Inventory event:', event?.type, event)
        if (event) {
          handleEvent(event as MigrationEvent)
        }
      }
      
      console.log('Inventory scan complete, processed', eventCount, 'events')
      // Don't auto-transition - let the InventoryProgress component handle it via onComplete
    } catch (err) {
      console.error('Inventory error:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [client, spaceDIDs, roundaboutURL, handleEvent])

  const runPlanner = useCallback(async () => {
    if (!state) {
      setError(new Error('Migration state not available. Please complete the scan step first.'))
      return
    }
    if (!walletClient) {
      setError(new Error('Wallet not connected. Please connect your wallet first.'))
      return
    }

    setError(null)
    setProgress(p => ({ ...p, phase: 'planning' }))

    try {
      // Initialize Synapse SDK with wallet
      const { Synapse, mainnet } = await import('@filoz/synapse-sdk')
      const { custom } = await import('viem')
      
      if (!walletClient.account) {
        throw new Error('Wallet account not available')
      }
      
      // Synapse.create expects account and transport
      const synapse = Synapse.create({
        chain: mainnet,
        transport: custom((window as any).ethereum),
        account: walletClient.account,
      } as any)
      synapseRef.current = synapse

      const { createMigrationPlan } = await import('@storacha/filecoin-pin-migration')
      
      for await (const event of createMigrationPlan({
        synapse,
        state: state as any,
      })) {
        if (event) {
          handleEvent(event as MigrationEvent)
        }
      }
      setStep('approval')
    } catch (err) {
      console.error('Planning error:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [state, walletClient, handleEvent])

  const runMigration = useCallback(async () => {
    if (!state || !plan || !synapseRef.current) {
      setError(new Error('State, plan, or synapse not available'))
      return
    }

    setError(null)
    setProgress(p => ({ ...p, phase: 'executing' }))

    try {
      const { executeMigration } = await import('@storacha/filecoin-pin-migration')
      
      for await (const event of executeMigration({
        plan: plan as any,
        state: state as any,
        synapse: synapseRef.current,
      })) {
        handleEvent(event as MigrationEvent)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [state, plan, handleEvent])

  const reset = useCallback(() => {
    clearPersistedState(spaceDIDs)
    setState(null)
    setPlan(null)
    setProgress(initialProgress)
    setError(null)
    setStep('connect')
    synapseRef.current = null
  }, [spaceDIDs])

  return {
    step,
    setStep,
    walletClient,
    setWalletClient,
    state,
    plan,
    progress,
    error,
    runInventory,
    runPlanner,
    runMigration,
    reset,
  }
}
