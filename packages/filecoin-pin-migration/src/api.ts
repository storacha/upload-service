import type { DID } from '@ucanto/interface'
import type { Synapse, PieceCID } from '@filoz/synapse-sdk'
import type { StorageContext } from '@filoz/synapse-sdk/storage'
import type { UnknownLink, MultihashDigest } from 'multiformats'
import type { Client } from '@storacha/client'
import type { Client as IndexingClient } from '@storacha/indexing-service-client'
import { PieceView } from '@web3-storage/data-segment'

export type { PieceLink, PieceView } from '@web3-storage/data-segment'
export type { MultihashDigest, UnknownLink }
export type { Synapse, StorageContext, PieceCID }

export type SpaceDID = DID<'key'>

/**
 * Per-shard inventory entry resolved by the reader.
 *
 * CIDs are kept as strings throughout the plan/state surface and
 * converted to typed values only at the Synapse SDK boundary inside the
 * migrator. Keeps serialization trivial.
 */
export interface ResolvedShard {
  /** Upload root CID this shard belongs to */
  root: string
  /** Shard CID (base32 CIDv1) */
  cid: string
  /** Filecoin piece CID (bafkz...) */
  pieceCID: string
  /** Source URL for SP pull */
  sourceURL: string
  /** Shard size in bytes */
  sizeBytes: bigint
}

/** Shard entry routed through the store() migration flow. */
export type StoreShard = Omit<ResolvedShard, 'pieceCID'> & {
  /** Present when the source shard already has a piece CID, absent otherwise. */
  pieceCID?: string
}

/** Return type of buildMigrationInventory(). */
export interface SpaceInventory {
  /** DID identifying the space */
  did: SpaceDID
  /** Space name */
  name?: string
  /** Root CIDs of uploads where all shards resolved successfully */
  uploads: string[]
  /** Flat list of resolved shards — each carries its upload root */
  shards: ResolvedShard[]
  /** Shards that must be migrated via store() instead of source pull. */
  shardsToStore: StoreShard[]
  /** Root CIDs of uploads skipped because one or more shards could not be resolved */
  skippedUploads: string[]
  /** Total size (bytes) of all resolved shards — only counter that can't be derived from .length */
  totalBytes: bigint
  /** Total size (bytes) of all currently migratable shards used for cost pricing. */
  totalSizeToMigrate: bigint
}

/**
 * Precomputed inventory view used by helper/state logic that needs shard-root
 * expansion without rescanning the full inventory repeatedly.
 */
export interface InventoryCommitView {
  representativeRootByShardCid: Map<string, string>
  multiRootShards: Map<string, string[]>
}

/**
 * Pre-flight migration plan. Presented to the user for approval before execution.
 *
 * Carries the live `MigrationCostResult` (with live StorageContext handles in
 * `costs.perSpace[].copies[].context`) for in-process hand-off to the migrator.
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
    bytesToMigrate: bigint
  }
  costs: MigrationCostResult
  warnings: string[]
  /** True when all prerequisites are met and migration can proceed */
  ready: boolean
  /**
   * Amount to pass to synapse.payments.fundSync — includes a 10% safety buffer
   * over the deposit to cover gas estimation variance. 0n when no deposit is needed.
   */
  fundingAmount: bigint
}

/**
 * Per-copy cost breakdown returned by computeMigrationCosts().
 *
 * `context` is a live (non-serializable) StorageContext — used by the migrator
 * to skip re-creating contexts. Persistable identifiers live alongside it.
 */
export interface PerCopyCost {
  copyIndex: number
  spaceDID: SpaceDID
  context: StorageContext
  /** bigint — persist for resume so the same SP is forced via createContext({ providerIds }). */
  providerId: bigint
  /** 0x-address — persist for display/audit only. */
  serviceProvider: `0x${string}`
  /** bigint | null — null until first commit; passed as dataSetIds on resume. */
  dataSetId: bigint | null
  withCDN: boolean
  isResumed: boolean
  bytesToMigrate: bigint
  currentDataSetSize: bigint
  /** USDFC delta this migration adds to the lockup (includes sybilFee on fresh datasets). */
  lockupUSDFC: bigint
  /** 0n on resumed datasets. */
  sybilFee: bigint
  /** 0n unless CDN is enabled on a fresh dataset. */
  cdnFixedLockup: bigint
  rateLockupDelta: bigint
  /**
   * POST-migration ongoing rate, NOT the delta. Display copy must say
   * "After migration: X USDFC/month ongoing".
   */
  ratePerEpoch: bigint
  ratePerMonth: bigint
}

/**
 * Per-space cost breakdown returned by computeMigrationCosts().
 *
 * A space always carries exactly two copies. Space-level numeric fields are
 * sums of the two copy-level values for display and funding math.
 */
export interface PerSpaceCost {
  spaceDID: SpaceDID
  copies: [PerCopyCost, PerCopyCost]
  isResumed: boolean
  bytesToMigrate: bigint
  currentDataSetSize: bigint
  lockupUSDFC: bigint
  sybilFee: bigint
  cdnFixedLockup: bigint
  rateLockupDelta: bigint
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
  resumedCopies: number
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
 *  - `pinnedProviderIds` forces the same SP binding across runs, per copy.
 *  - `existingDataSetIds` binds to the existing on-chain dataset for
 *    floor-aware rate delta computation.
 */
export interface ResumeState {
  existingDataSetIds?: Map<SpaceDID, Map<number, bigint>>
  pinnedProviderIds?: Map<SpaceDID, Map<number, bigint>>
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
 *   pending    — no pulls or commits completed yet
 *   migrating  — at least one shard pulled or committed
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
 * Per-upload lifecycle — computed from copy.committed + inventory, not stored.
 *   pending    — no shards committed yet
 *   migrating  — some shards committed, not all
 *   complete   — all shards committed
 *   incomplete — space loop ended, upload still has uncommitted shards
 */
export type UploadPhase = 'pending' | 'migrating' | 'complete' | 'incomplete'

/**
 * Per-copy resume record and progress tracker within a space.
 *
 * Each copy binds to its own storage provider and eventual on-chain dataset.
 * Pull/commit progress is tracked independently so resume can continue each
 * copy without interfering with the other.
 */
export interface SpaceCopyState {
  copyIndex: number
  /** Locks SP selection across runs. Passed back as providerIds on resume. */
  providerId: bigint
  /** Display/audit only. */
  serviceProvider: `0x${string}`
  /** Provider PDP service URL used to validate staged shards on resume/debug. */
  providerURL: string | null
  /** null until first commit; then passed as dataSetIds on resume. */
  dataSetId: bigint | null
  /**
   * Shard CIDs pulled successfully and ready for commit.
   * This set can contain both source-pull and store-path shard CIDs.
   */
  pulled: Set<string>
  /** Committed shard-root pairs encoded as `${shardCid}#${rootCid}`. */
  committed: Set<string>
  /** Upload root CIDs that had at least one shard failure during migration. */
  failedUploads: Set<string>
  /**
   * Stored shard piece CIDs persisted after copy 0 store() succeeds.
   * These remain available after full commit so retries/debug helpers can
   * still reuse or inspect the durable stored piece mapping.
   */
  storedShards: Record<string, string>
}

/**
 * Per-space resume record and progress tracker.
 *
 * `copies` is the source of truth for provider bindings, datasets, and
 * per-copy progress.
 */
export interface SpaceState {
  did: SpaceDID
  phase: SpacePhase
  copies: SpaceCopyState[]
}

/**
 * Persisted resume state for a migration. Serializable to JSON via
 * serializeState() / deserializeState().
 *
 * spacesInventories holds reader output — completed spaces have no cursor entry;
 * in-progress spaces have a matching entry in readerProgressCursors.
 */
export interface MigrationState {
  /** Persisted state schema version. */
  version: number
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
  /** Count of shard-root pairs successfully committed across all spaces. */
  succeeded: number
  /** Count of shard-root pairs that were not committed (failures). */
  failed: number
  /** Count of uploads excluded at inventory time (one or more shards unresolvable). */
  skippedUploads: number
  dataSetIds: bigint[]
  /** Total bytes across all resolved shards in the plan. */
  totalBytes: bigint
}

// ── Stage inputs ─────────────────────────────────────────────────────────────

export type UploadRootsBySpace = Record<SpaceDID, string[]>

interface BuildInventoriesBaseInput {
  /** Authenticated @storacha/client instance */
  client: Client
  /** Resolves the final sourceURL for each shard */
  resolver: SourceURLResolver
  /** Store that owns state; used for resume and checkpointing */
  store: MigrationStore
  /** AbortSignal for cooperative cancellation during reader I/O. */
  signal?: AbortSignal
  options?: {
    /** Override the default indexing service URL */
    serviceURL?: URL
    /** Inject a custom indexing service reader (tests) */
    indexer?: IndexingServiceReader
    /** Fetch implementation used for the built-in cid.contact fallback. */
    fetcher?: typeof fetch
    /** Stop resolving remaining shards on first failure per upload (default: true) */
    stopOnError?: boolean
    /**
     * Number of uploads to request per upload.list page (default: 100).
     *
     * When `uploadRootsBySpace` is provided, this becomes the number of
     * explicit roots to process per synthetic chunk.
     *
     * Keep this modest: larger pages/chunks increase reader memory usage and
     * the amount of claim-resolution work done before the next checkpoint.
     */
    uploadPageSize?: number
    /**
     * Number of concurrent upload.shard.list waves per upload page
     */
    shardListConcurrency?: number
    /**
     * Emit state:checkpoint every N upload pages (default: 1).
     *
     * When `uploadRootsBySpace` is provided, the same setting applies to
     * explicit-root chunks.
     *
     * Higher values reduce checkpoint I/O but can require re-processing up to
     * N - 1 pages after an ungraceful interruption.
     */
    checkpointEveryPages?: number
    /**
     * Number of concurrent queryClaims sub-batches per upload page
     * (default: 1).
     */
    queryClaimsBatchConcurrency?: number
    /**
     * Skip the cid.contact repair step entirely (default: false).
     * When true, the cid.contact repair step is bypassed. Shards missing a
     * locationURL after primary claims are still probed via the carpark
     * fallback.
     */
    skipIPNIFallback?: boolean
  }
}

/** Input for buildMigrationInventories() — the reader stage. */
export type BuildInventoriesInput = BuildInventoriesBaseInput &
  (
    | {
        /** Defaults to all spaces on the client when no selector is provided. */
        spaceDIDs?: SpaceDID[]
        uploadRootsBySpace?: never
      }
    | {
        /**
         * Read exactly these trusted upload roots grouped by space.
         *
         * In this mode the reader skips `upload.list()` entirely, chunks the
         * supplied roots by `uploadPageSize`, and stores synthetic
         * `readerProgressCursors` values to support resume within the explicit
         * root list.
         */
        uploadRootsBySpace: UploadRootsBySpace
        spaceDIDs?: never
      }
  )

/** Input for createMigrationPlan() — the planner stage. */
export interface CreatePlanInput {
  /** Initialized @filoz/synapse-sdk Synapse instance */
  synapse: Synapse
  /** Store that owns state; SP bindings written after cost computation */
  store: MigrationStore
  /**
   * Target storage provider IDs. At least two distinct IDs are required when
   * provided so the planner can bind one provider per copy. When omitted, the
   * SDK auto-selects and the planner validates that the two chosen providers
   * are distinct. On resume, pinned per-copy providers extracted from state
   * always win.
   */
  providerIds?: bigint[]
}

/** Input for executeMigration() — the migrator stage. */
export interface ExecuteMigrationInput {
  /** Approved plan from createMigrationPlan() */
  plan: MigrationPlan
  /** Store that owns state; tracks committed shards and phase */
  store: MigrationStore
  /** Initialized Synapse SDK instance */
  synapse: Synapse
  /** Pieces per pull batch (default: 50) */
  batchSize?: number
  /** Fetch implementation used when the inventory contains shardsToStore */
  fetcher?: typeof fetch
  /** Number of shards to download+store concurrently per space (default: 10) */
  storeConcurrency?: number
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /**
   * Max commit retry attempts for a failing commit batch (default: 3).
   * 0 = auto-skip on commit failure, no commit:failed event yielded.
   */
  maxCommitRetries?: number
  /**
   * Timeout in ms for consumer to call retry/skip on a commit:failed event
   * (default: 30000). Auto-skips when exceeded.
   */
  commitRetryTimeout?: number
  /**
   * Number of batches to presign+pull concurrently (default: 4).
   * Set to 1 to restore sequential pull behavior.
   */
  pullConcurrency?: number
  /**
   * Max concurrent Phase 2 (add-pieces) commit batches per copy (default: 4).
   * Phase 1 (dataset creation) always runs sequentially. Set to 1 to restore
   * fully sequential commit behavior.
   */
  commitConcurrency?: number
}

export interface ExecuteStoreMigrationInput {
  /** Approved plan from createMigrationPlan() */
  plan: MigrationPlan
  /** Store that owns state; tracks stored and committed shards and phase */
  store: MigrationStore
  /** Initialized Synapse SDK instance */
  synapse: Synapse
  /** Shards per store checkpoint batch and per secondary pull batch (default: 50) */
  batchSize?: number
  /** Fetch implementation used to download shard bytes */
  fetcher?: typeof fetch
  /** Number of shards to download+store concurrently per space (default: 10) */
  storeConcurrency?: number
  /** Number of secondary pull batches to run concurrently per space (default: 4) */
  pullConcurrency?: number
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Max commit retry attempts for a failing commit batch (default: 3) */
  maxCommitRetries?: number
  /** Timeout in ms for consumer to call retry/skip on a commit:failed event */
  commitRetryTimeout?: number
  /**
   * Max concurrent Phase 2 (add-pieces) commit batches per copy (default: 4).
   * Phase 1 (dataset creation) always runs sequentially.
   */
  commitConcurrency?: number
}

/**
 * Events yielded by buildMigrationInventories() and executeMigration().
 *
 * Reader lifecycle:
 *   reader:space:start → (state:checkpoint per page) → reader:space:complete
 *   reader:complete — once, after all spaces are inventoried; state.phase → 'planning'
 *
 * Planner lifecycle:
 *   planner:ready — once, after costs computed and SP bindings written to state;
 *   consumer displays plan to the user for approval before calling executeMigration
 *
 * Funding lifecycle (single pre-flight transaction):
 *   funding:start → funding:complete
 *   funding:failed (before re-throwing — generator terminates after this)
 *
 * Migrator lifecycle:
 *   migration:space:start / migration:space:complete
 *   migration:copy:start / migration:copy:complete
 *   migration:phase:start / migration:phase:complete
 *
 * Pull/commit errors:
 *   migration:batch:failed — emitted for pull/store batch failures and commit-batch failures
 *   migration:commit:failed — emitted when a commit batch fails and the
 *   consumer may decide retry vs skip
 *   migration:commit:settled — emitted when a commit batch finally succeeds or
 *   fails
 *
 * State persistence:
 *   state:checkpoint — emitted after each reader page, after planner writes SP
 *   bindings, after migrator progress for each copy, and once more after the
 *   top-level migration phase is finalized; consumer persists to disk on this
 *   event
 *
 * Terminal:
 *   migration:complete — once, after all spaces are processed
 *
 * Progress is derived from MigrationState on each state:checkpoint.
 * Upload progress (committed vs total shards) is computed from each
 * copy.committed set plus the actionable shard buckets in
 * spacesInventories[did] (`shards` and `shardsToStore`).
 */
export type MigrationEvent =
  | { type: 'reader:space:start'; spaceDID: SpaceDID }
  | {
      type: 'reader:shard:failed'
      spaceDID: SpaceDID
      root: string
      shard: string
      reason: string
    }
  | { type: 'reader:space:complete'; spaceDID: SpaceDID }
  | { type: 'reader:complete' }
  | { type: 'planner:ready'; plan: MigrationPlan }
  | { type: 'funding:start'; amount: bigint }
  | { type: 'funding:complete'; txHash: string }
  | { type: 'funding:failed'; error: Error }
  | { type: 'migration:space:start'; spaceDID: SpaceDID }
  | {
      type: 'migration:space:complete'
      spaceDID: SpaceDID
      phase: SpacePhase
    }
  | {
      type: 'migration:copy:start'
      spaceDID: SpaceDID
      copyIndex: number
    }
  | {
      type: 'migration:copy:complete'
      spaceDID: SpaceDID
      copyIndex: number
      completed: boolean
    }
  | {
      type: 'migration:phase:start'
      spaceDID: SpaceDID
      copyIndex: number
      phase: MigrationExecutionPhase
      itemCount?: number
      batchCount?: number
    }
  | {
      type: 'migration:phase:complete'
      spaceDID: SpaceDID
      copyIndex: number
      phase: MigrationExecutionPhase
      completed: boolean
    }
  | {
      type: 'migration:batch:failed'
      spaceDID: SpaceDID
      copyIndex: number
      /** Which pull/commit stage produced the failure */
      stage: MigrationExecutionPhase
      error: Error
      /** Upload root CIDs affected by this batch failure */
      roots: Array<string>
    }
  | {
      type: 'migration:commit:failed'
      spaceDID: SpaceDID
      copyIndex: number
      commitIndex: number
      pieceCount: number
      error: Error
      /** Upload root CIDs affected */
      roots: string[]
      /** Current attempt number (1-based) */
      attempt: number
      /** Call to retry the failing commit batch (re-presign + commit) */
      retry: () => void
      /** Call to skip the failing commit batch and continue with later work */
      skip: () => void
    }
  | {
      type: 'migration:commit:settled'
      spaceDID: SpaceDID
      copyIndex: number
      commitIndex: number
      pieceCount: number
      status: 'succeeded' | 'failed'
      txHash?: string
      error?: Error
      roots: string[]
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

/** A shard discovered during inventory, before claim resolution. */
export interface ShardEntry {
  /** CID string from the upload table */
  cidStr: string
  /** Raw multihash digest */
  multihash: MultihashDigest
  /** base58btc-encoded multihash bytes */
  b58: string
}

/** Claim data extracted from a batch queryClaims response, keyed by b58 multihash. */
export interface ClaimsEntry {
  locationURL: string | null
  piece: PieceView | null
  size: bigint
}

// ── Source URL resolver ────────────────────────────────────────────────────

/** Resolves a source URL for a shard. Applied only in the reader. */
export interface SourceURLResolver {
  resolve(shard: ResolvedShard | StoreShard): string
}

// ── Migrator interfaces ────────────────────────────────────────────────────────

/**
 * User-facing execution phases emitted by the migrator.
 */
export type MigrationExecutionPhase =
  | 'store'
  | 'source-pull'
  | 'secondary-pull'
  | 'commit'

export interface CommitEntry {
  shardCid: string
  pieceCID: string
  root: string
}

export type CommittedEntry = CommitEntry

/** Pre-mapped piece ready for presign/commit, carrying shard metadata for recording. */
export interface CommitPiece {
  pieceCid: PieceCID
  pieceMetadata: { ipfsRootCID: string }
  /** Shard CAR CID — needed for commit recording, ignored by presign/commit SDK calls */
  shardCid: string
}

export interface BatchResult {
  /** Stage that produced the failure, if any */
  stage?: MigrationExecutionPhase
  dataSetId: bigint | undefined
  /** Transaction hash for a successful commit batch */
  txHash?: string
  committed: CommittedEntry[]
  error?: Error
  /** Upload root CIDs affected by the commit batch failure */
  failedUploads: Set<string>
  /** Pre-mapped commit pieces for retry — present only on commit failure */
  commitPieces?: CommitPiece[]
}

/** Shared retry metadata attached to exhausted operational failures. */
export interface RetryDiagnostics {
  /** Number of attempts that actually ran. 1 when retriesConfigured is 0. */
  attempts: number
  /** Retry budget passed into the retried operation helper. */
  retriesConfigured: number
  /** Wall-clock time spent across all attempts. */
  elapsedMs: number
}

/**
 * Optional store-path diagnostics attached to a failed store error when the
 * shard download stream could be correlated with expected and observed bytes.
 */
export interface StoreDiagnosticError extends Error, RetryDiagnostics {
  cause?: unknown
  retryable?: boolean
  status?: number
  shardCid: string
  root: string
  sourceURL: string
  expectedBytes: bigint | null
  observedBytes: bigint
  failureStep: 'fetch' | 'store'
}

/** Diagnostics attached to exhausted operational pull failures. */
export interface PullDiagnosticError extends Error, RetryDiagnostics {
  cause?: unknown
  retryable?: boolean
  status?: number
  phase: MigrationExecutionPhase
  failureStep: 'pull'
  pieceCount: number
  rootCount: number
  rootsSample: string[]
  pieceCIDsSample: string[]
  sourceURLsSample: string[]
}

/**
 * Result of presign+pull for a single batch.
 */
export interface PullResult<T = ResolvedShard> {
  /** Entries that pulled successfully before cross-batch failed-root reconciliation */
  pulledCandidates: T[]
  /** Representative entries whose piece pull/presign failed for this batch. */
  failedEntries: T[]
  /** Upload root CIDs that had failures during presign or pull */
  failedUploads: Set<string>
  /** Distinguishes upload-quality failures from operational failures */
  failureKind?: 'upload' | 'operational'
  /** User-facing execution phase that failed */
  stage?: MigrationExecutionPhase
  /** Error from the failed stage, if any */
  error?: Error
}

// ── Migration store ──────────────────────────────────────────────────────────

/**
 * Bucket a shard belongs to in the inventory.
 *   pull  — entry from `SpaceInventory.shards` (source-pull flow; pieceCID known)
 *   store — entry from `SpaceInventory.shardsToStore` (store() flow; pieceCID may be absent)
 */
export type ShardKind = 'pull' | 'store'

/**
 * Persistence implementation selector for {@link CreateStoreOptions}.
 *
 * `sqlite` is reserved for the future SQLite backend. Until that backend
 * lands, any factory using this type must fail explicitly for `'sqlite'`
 * instead of silently falling back.
 */
export type StoreType = 'json' | 'sqlite'

/**
 * A row yielded by {@link MigrationStore.iterateShards} / iterateCommittableShards.
 *
 * Discriminated by `kind`:
 *   - `pull` rows always carry a known pieceCID.
 *   - `store` rows may have `pieceCID: null` until copy-0 store() resolves one.
 */
export type StoreShardRow =
  | {
      kind: 'pull'
      spaceDID: SpaceDID
      shardCid: string
      root: string
      sourceURL: string
      sizeBytes: bigint
      pieceCID: string
    }
  | {
      kind: 'store'
      spaceDID: SpaceDID
      shardCid: string
      root: string
      sourceURL: string
      sizeBytes: bigint
      pieceCID: string | null
    }

/**
 * Backend-selection options for the store factory.
 *
 * `type` selects the persistence implementation; `path` is the on-disk
 * path (file for JSON, file for SQLite).
 */
export interface CreateStoreOptions {
  type: StoreType
  path: string
}

/** Reader-stage checkpoint input — mirrors `state.checkpointInventoryPage`. */
export interface CheckpointInventoryPageInput {
  spaceDID: SpaceDID
  name?: string
  shards: ResolvedShard[]
  shardsToStore: StoreShard[]
  uploads: string[]
  skippedUploads: string[]
  totalBytes: bigint
  totalSizeToMigrate: bigint
  cursor: string | undefined
}

/** Pull-checkpoint input — mirrors `state.recordPull`. */
export interface RecordPullInput {
  spaceDID: SpaceDID
  copyIndex: number
  shardCid: string
  shardRoots: string[]
}

/** Commit-checkpoint input — mirrors `state.recordCommit`. */
export interface RecordCommitInput {
  spaceDID: SpaceDID
  copyIndex: number
  shardCid: string
  root: string
  dataSetId: bigint
  shardRoots: string[]
}

/**
 * Persistence boundary for migration state.
 *
 * The store **owns** a {@link MigrationState} internally; callers do not pass
 * it in. The mutation surface is a 1:1 wrap of `src/state.js` (less the
 * leading `state` argument) so swapping call sites onto the store is purely
 * mechanical.
 *
 * Mixed sync/async contract:
 *
 *   - Mutations and queries are **synchronous** so the migrator can stay on
 *     the same tick as state-machine transitions. Durability is a separate
 *     concern handled by `checkpoint()`.
 *   - `checkpoint()` is **async** — it is the explicit durability barrier and
 *     awaits a real flush to disk.
 *   - `close()` is **async** — graceful shutdown, drains in-flight writes.
 *   - `closeSync()` is **sync** — emergency shutdown for signal handlers
 *     (SIGINT/SIGTERM) where the event loop cannot be relied on. Best-effort
 *     flush of the current in-memory state.
 *
 * Lifecycle FSM: `'open' → 'closing' → 'closed'`.
 * Outside `'open'`, mutations / queries / `checkpoint()` throw `StoreClosedError`.
 * Both `close()` and `closeSync()` are idempotent.
 */
export interface MigrationStore {
  // ── Read access ──────────────────────────────────────────────────────────

  /**
   * Return the live in-memory {@link MigrationState} the store owns.
   *
   * Temporary migration seam for Commit 2 call-site rewiring. Do not add new
   * long-term call sites to `getState()`; prefer narrow store queries and
   * iterators instead.
   *
   * SQLite-backed stores will materialize the full state from rows on each
   * call, which is expensive on large migrations — another reason to use
   * iterator/query methods for new code.
   *
   * **Callers MUST NOT mutate the returned object.** All mutations must go
   * through the `record*` / `transitionTo*` / `finalize*` methods so the
   * store can persist them. Direct mutation will not be flushed and will be
   * lost on the next reload.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  getState(): MigrationState

  /**
   * Iterate over shards for a space.
   *
   * The iterator validates the store is `'open'` both at creation **and** on
   * each `.next()` — closing the store mid-iteration causes the next pull to
   * throw `StoreClosedError`.
   *
   * @param spaceDID Space whose inventory rows should be yielded.
   * @param options Optional iterator controls.
   * @param options.kind Restrict iteration to one bucket; omit to iterate both.
   * @throws StoreClosedError if the store is not in `'open'` state at iteration time.
   */
  iterateShards(
    spaceDID: SpaceDID,
    options?: { kind?: ShardKind }
  ): Iterable<StoreShardRow>

  /**
   * Iterate over shards eligible for commit on the given copy: every shard
   * that has been pulled and has a known pieceCID, minus shards already
   * committed for that copy.
   *
   * Filters out `store`-kind rows whose pieceCID is still `null`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state at iteration time.
   */
  iterateCommittableShards(
    spaceDID: SpaceDID,
    copyIndex: number
  ): Iterable<StoreShardRow & { pieceCID: string }>

  // ── Mutations (1:1 with state.js) ────────────────────────────────────────

  /**
   * Append a reader page into the space's inventory entry. Mirrors
   * `state.checkpointInventoryPage`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  checkpointInventoryPage(page: CheckpointInventoryPageInput): void

  /**
   * Transition the top-level migration phase to `'planning'`. Mirrors
   * `state.transitionToPlanning`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  transitionToPlanning(): void

  /**
   * Transition the top-level migration phase to `'migrating'`. Mirrors
   * `state.transitionToMigrating`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  transitionToMigrating(): void

  /**
   * Populate `state.spaces` with per-copy SP bindings from the cost result,
   * then transition the top-level phase to `'approved'`. Mirrors
   * `state.transitionToApproved`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   * @throws ResumeBindingDriftError if a planned copy disagrees with the
   *   persisted provider / dataset binding for the same copy index.
   */
  transitionToApproved(perSpaceCost: PerSpaceCost[]): void

  /**
   * Transition the top-level migration phase to `'funded'`. Mirrors
   * `state.transitionToFunded`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  transitionToFunded(): void

  /**
   * Mark a shard as pulled for the given copy. Mirrors `state.recordPull`.
   *
   * @returns true when the in-memory state actually changed.
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  recordPull(input: RecordPullInput): boolean

  /**
   * Record a successful commit for a shard+root pair on the given copy.
   * Mirrors `state.recordCommit`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  recordCommit(input: RecordCommitInput): void

  /**
   * Record a successful store() on copy 0 — captures the pieceCID returned
   * by the SDK so secondary pulls can address the durable piece. Mirrors
   * `state.recordStoredShard`.
   *
   * @returns true when the in-memory state actually changed.
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  recordStoredShard(
    spaceDID: SpaceDID,
    shardCid: string,
    pieceCID: string
  ): boolean

  /**
   * Record an upload-root failure on the given copy. Mirrors
   * `state.recordFailedUpload`.
   *
   * @returns true when the in-memory state actually changed.
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  recordFailedUpload(
    spaceDID: SpaceDID,
    copyIndex: number,
    root: string
  ): boolean

  /**
   * Clear persisted failed upload roots for a space so a resumed run can
   * retry them again on both copies. Mirrors
   * `state.clearFailedUploadsForRetry`.
   *
   * @returns count of unique failed roots cleared across both copies.
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  clearFailedUploadsForRetry(spaceDID: SpaceDID): number

  /**
   * Resolve the terminal {@link SpacePhase} for a space from its per-copy
   * committed counts versus inventory shard counts, and write it. Mirrors
   * `state.finalizeSpace` — the store computes the phase; callers do not
   * pass it in.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  finalizeSpace(spaceDID: SpaceDID): void

  /**
   * Resolve the terminal top-level {@link MigrationPhase} and write it.
   * Mirrors `state.finalizeMigration`.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  finalizeMigration(): void

  // ── Durability + lifecycle ───────────────────────────────────────────────

  /**
   * Durability barrier. Resolves once the latest in-memory state has been
   * flushed to the backing storage.
   *
   * @throws StoreClosedError if the store is not in `'open'` state.
   */
  checkpoint(): Promise<void>

  /**
   * Graceful shutdown. Drains in-flight writes, releases the on-disk lock,
   * then transitions the lifecycle to `'closed'`. Idempotent — subsequent
   * calls resolve immediately.
   */
  close(): Promise<void>

  /**
   * Emergency synchronous shutdown for signal handlers (SIGINT/SIGTERM) where
   * the event loop cannot be trusted to run microtasks. Best-effort sync
   * flush of current in-memory state, then transitions to `'closed'`.
   *
   * Do NOT call from normal application flow — use `close()` instead.
   * Idempotent — subsequent calls are no-ops.
   */
  closeSync(): void
}
