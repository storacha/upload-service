import type { DID } from '@ucanto/interface'
import type { Synapse, PieceCID } from '@filoz/synapse-sdk'
import type { StorageContext } from '@filoz/synapse-sdk/storage'
import type { UnknownLink, MultihashDigest } from 'multiformats'
import type { Client } from '@storacha/client'
import type { Client as IndexingClient } from '@storacha/indexing-service-client'

export type { PieceLink, PieceView } from '@web3-storage/data-segment'
export type { MultihashDigest, UnknownLink }
export type { Synapse, StorageContext, PieceCID }

export type SpaceDID = DID<'key'>

/**
 * Configuration provided by CLI or Console to drive a migration.
 */
export interface MigrationConfig {
  storacha: {
    /** Authenticated @storacha/client instance */
    client: Client
    /** Filter to specific space DIDs */
    spaces?: SpaceDID[]
  }
  foc: {
    /** Initialized @filoz/synapse-sdk Synapse instance */
    synapse: Synapse
    /**
     * Target storage provider IDs (default: SDK auto-select).
     * On resume, pinned providers extracted from the persisted MigrationState
     * always win over this value.
     */
    providerIds?: bigint[]
  }
  sourceURL: {
    strategy: 'roundabout' | 'claims'
    /** Override roundabout endpoint URL */
    roundaboutURL?: string
  }
  options?: {
    /** Pieces per pull batch (default: 50) */
    batchSize?: number
    /** A failure stops the remaining batches in an upload level (default: false) */
    stopOnError?: boolean
    /** AbortSignal for cancellation */
    signal?: AbortSignal
  }
}

/**
 * Per-shard inventory entry resolved by the reader.
 *
 * CIDs are kept as strings throughout the plan/state surface and
 * converted to typed values only at the Synapse SDK boundary inside the
 * migrator. Keeps serialization trivial.
 */
export interface ResolvedShard {
  /** Shard CID (base32 CIDv1) */
  cid: string
  /** Filecoin piece CID (bafkz...) */
  pieceCID: string
  /** Source URL for SP pull */
  sourceURL: string
  /** Shard size in bytes */
  sizeBytes: bigint
}

/** Return type of buildMigrationInventory(). */
export interface SpaceInventory {
  /** DID identifying the space */
  did: SpaceDID
  /** All uploads in this space, keyed by root CID for O(1) lookup */
  uploads: Record<string, { shards: ResolvedShard[] }>
  /** Shards that could not be resolved */
  skippedShards: Array<{ cid: string; reason: string }>
  /** Number of uploads in this space. */
  totalUploads: number
  /** Total number of resolved shards across all uploads. */
  totalShards: number
  /** Total size (bytes) of all resolved shards */
  totalBytes: bigint
}

/**
 * Pre-flight migration plan. Presented to the user for approval before execution.
 *
 * Carries the live `MigrationCostResult` (with live StorageContext handles in
 * `costs.perSpace[].context`) for in-process hand-off to the migrator.
 *
 * Space-level upload data lives in `MigrationState.spacesInventories` — the
 * migrator reads from there directly, so `MigrationPlan` carries only what is
 * needed for display/approval and execution.
 */
export interface MigrationPlan {
  totals: {
    uploads: number
    shards: number
    bytes: bigint
  }
  costs: MigrationCostResult
  warnings: string[]
  /** True when all prerequisites are met and migration can proceed */
  ready: boolean
}

/**
 * Per-space cost breakdown returned by computeMigrationCosts().
 *
 * `context` is a live (non-serializable) StorageContext — used by the migrator
 * to skip re-creating contexts. Persistable identifiers live alongside it
 * (providerId, serviceProvider, dataSetId).
 */
export interface PerSpaceCost {
  spaceDID: SpaceDID
  context: StorageContext
  /** bigint — persist for resume so the same SP is forced via createContext({ providerIds }). */
  providerId: bigint
  /** 0x-address — persist for display/audit only. */
  serviceProvider: `0x${string}`
  /** bigint | null — null until first commit; passed as dataSetIds on resume. */
  dataSetId: bigint | null
  isResumed: boolean
  bytesToMigrate: bigint
  currentDataSetSize: bigint
  /** USDFC delta this migration adds to the lockup (includes sybilFee on fresh datasets). */
  lockupUSDFC: bigint
  /** 0n on resumed datasets. */
  sybilFee: bigint
  rateLockupDelta: bigint
  /**
   * POST-migration ongoing rate, NOT the delta. Display copy must say
   * "After migration: X USDFC/month ongoing".
   */
  ratePerEpoch: bigint
  ratePerMonth: bigint
}

export interface MigrationCostSummary {
  totalBytes: bigint
  totalLockupUSDFC: bigint
  /** post-migration total rate, not the delta */
  totalRatePerEpoch: bigint
  totalRatePerMonth: bigint
  debt: bigint
  runway: bigint
  buffer: bigint
  availableFunds: bigint
  skipBufferApplied: boolean
  resumedSpaces: number
}

export interface MigrationCostResult {
  perSpace: PerSpaceCost[]
  summary: MigrationCostSummary
  /** Single-tx amount to pass to synapse.payments.fundSync. 0n if already funded. */
  totalDepositNeeded: bigint
  needsFwssMaxApproval: boolean
  ready: boolean
  warnings: string[]
}

/**
 * Internal resume input for computeMigrationCosts().
 *
 * Extracted from a persisted MigrationState by buildResumeState(), which is
 * called automatically by createMigrationPlan() when a state is passed.
 * Consumers do not construct this directly.
 *
 *  - `pinnedProviderIds` forces the same SP binding across runs.
 *  - `existingDataSetIds` binds to the existing on-chain dataset for
 *    floor-aware rate delta computation.
 */
export interface ResumeState {
  existingDataSetIds?: Map<SpaceDID, bigint>
  pinnedProviderIds?: Map<SpaceDID, bigint>
}

// ── Migration state ───────────────────────────────────────────────────────────

/**
 * Top-level migration lifecycle.
 *   reading    — reader is paginating spaces and building inventories
 *   planning   — reader complete; consumer should call createMigrationPlan
 *   approved   — plan approved, before fundSync
 *   funded     — fundSync landed
 *   migrating  — at least one space is being processed
 *   complete   — every space fully committed
 *   incomplete — migration finished, some spaces/uploads have uncommitted shards
 */
export type MigrationPhase =
  | 'reading'
  | 'planning'
  | 'approved'
  | 'funded'
  | 'migrating'
  | 'complete'
  | 'incomplete'

/**
 * Per-space lifecycle.
 *   pending    — no batches processed yet
 *   migrating  — at least one shard committed
 *   complete   — every upload fully committed
 *   incomplete — space processed, some uploads have uncommitted shards
 *   failed     — space abandoned with zero commits
 */
export type SpacePhase =
  | 'pending'
  | 'migrating'
  | 'complete'
  | 'incomplete'
  | 'failed'

/**
 * Per-upload lifecycle — computed from space.committed + inventory, not stored.
 *   pending    — no shards committed yet
 *   migrating  — some shards committed, not all
 *   complete   — all shards committed
 *   incomplete — space loop ended, upload still has uncommitted shards
 */
export type UploadPhase = 'pending' | 'migrating' | 'complete' | 'incomplete'

/**
 * Committed shard tracking for a space.
 *
 * Bundles the shard→providers map with its count so consumers never need
 * Object.keys().length — count is O(1) and always in sync.
 */
export interface CommittedShards {
  /** Shard CID → provider addresses that have committed it. */
  shards: Record<string, string[]>
  /** Count of unique committed shards. Incremented in recordCommit on first commit only. */
  count: number
}

/**
 * Per-space resume record and progress tracker.
 *
 * SP binding (providerId, dataSetId) enables planner resume.
 * committed tracks which shards have been committed to which providers,
 * enabling O(1) skip checks during migration and progress derivation.
 */
export interface SpaceState {
  did: SpaceDID
  phase: SpacePhase
  /** Locks SP selection across runs. Passed back as providerIds on resume. */
  providerId: bigint
  /** Display/audit only. */
  serviceProvider: `0x${string}`
  /** null until first commit; then passed as dataSetIds on resume. */
  dataSetId: bigint | null
  committed: CommittedShards
}

/**
 * Persisted resume state for a migration. Serializable to JSON via
 * serializeState() / deserializeState().
 *
 * spacesInventories holds reader output — completed spaces have no cursor entry;
 * in-progress spaces have a matching entry in readerProgressCursors.
 */
export interface MigrationState {
  phase: MigrationPhase
  spaces: Record<SpaceDID, SpaceState>
  /** Reader output keyed by space DID. Completed + in-progress spaces. */
  spacesInventories: Record<SpaceDID, SpaceInventory>
  /** Pagination cursor per space — present only while reading that space. */
  readerProgressCursors?: Record<SpaceDID, string>
}

/**
 * Summary returned when migration:complete is emitted.
 */
export interface MigrationSummary {
  /** Count of shards successfully committed across all spaces. */
  succeeded: number
  /** Count of shards that were not committed (failures). */
  failed: number
  /** Count of shards skipped at inventory time (missing pieceCID or URL). */
  skipped: number
  dataSetIds: bigint[]
  /** Total bytes across all resolved shards in the plan. */
  totalBytes: bigint
  /** Duration in milliseconds */
  duration: number
}

/**
 * Events yielded by buildMigrationInventories() and executeMigration().
 *
 * Reader lifecycle:
 *   reader:space:start → (state:checkpoint per page) → reader:space:complete
 *   reader:complete — once, after all spaces are inventoried; state.phase → 'planning'
 *
 * Planner lifecycle:
 *   plan:ready — once, after costs computed and SP bindings written to state;
 *   consumer displays plan to the user for approval before calling executeMigration
 *
 * Funding lifecycle (single pre-flight transaction):
 *   funding:start → funding:complete
 *   funding:failed (before re-throwing — generator terminates after this)
 *
 * Per-shard errors:
 *   shard:failed — emitted for every shard that fails presign, pull, or commit
 *
 * State persistence:
 *   state:checkpoint — emitted after each reader page, after planner writes SP
 *   bindings, and after each migrator batch; consumer persists to disk on this event
 *
 * Terminal:
 *   migration:complete — once, after all spaces are processed
 *
 * Progress is derived from MigrationState on each state:checkpoint.
 * Upload progress (committed vs total shards) is computed from
 * space.committed + spacesInventories[did].uploads[root].shards.
 */
export type MigrationEvent =
  | { type: 'reader:space:start'; spaceDID: SpaceDID }
  | { type: 'reader:space:complete'; spaceDID: SpaceDID }
  | { type: 'reader:complete' }
  | { type: 'plan:ready'; plan: MigrationPlan }
  | { type: 'funding:start'; amount: bigint }
  | { type: 'funding:complete' }
  | { type: 'funding:failed'; error: Error }
  | {
      type: 'shard:failed'
      spaceDID: SpaceDID
      root: string
      shard: string
      error: Error
    }
  | { type: 'state:checkpoint'; state: MigrationState }
  | { type: 'migration:complete'; summary: MigrationSummary }

// ── Reader interfaces ────────────────────────────────────────────────────────

/**
 * Derived from the real IndexingClient — never drifts from the implementation.
 * Tests satisfy this type by casting their mock objects.
 */
export type IndexingServiceReader = Pick<
  InstanceType<typeof IndexingClient>,
  'queryClaims'
>

/** Options for the built-in indexing service client. */
export interface IndexerOptions {
  /** Override the default indexing service URL. */
  serviceURL?: URL
}

/** A shard discovered during inventory. */
export interface ShardEntry {
  /** CID string from the upload table, or null if found only via indexing service */
  cidStr: string
  /** Raw multihash digest */
  multihash: MultihashDigest
  /** base58btc-encoded multihash bytes */
  b58: string
}

// ── Source URL resolver ────────────────────────────────────────────────────

/** Resolves a source URL for a shard. Used by planner and migrator. */
export interface SourceURLResolver {
  resolve(shard: ResolvedShard): string
}
