# Architecture — `@storacha/filecoin-pin-migration`

**Domain:** Storacha-to-FOC migration library  
**Last updated:** 2026-05-08

---

## Overview

A headless three-stage pipeline with explicit data contracts:

```
Reader → Planner → Migrator
```

- `reader` builds `SpaceInventory[]`, including optional space metadata such as the space name
- `planner` computes a `MigrationPlan`
- `migrator` executes the approved plan and mutates `MigrationState`

The library owns no UX or persistence. Callers persist `MigrationState` on
every `state:checkpoint` event.

Helper utilities live outside the main pipeline. They are headless audit /
estimation functions that can inspect or reconcile migration-related data
without participating in reader, planner, or migrator execution.

On `resume` / `retry`, a caller may optionally run a staged-shard validation
preflight before migration starts. This is also helper-driven logic outside the
pipeline: it probes persisted `pulled` / `storedShards` entries against the
provider PDP endpoint and can prune stale entries from state before execution.

---

## Responsibilities by Stage

| Stage    | Responsibility                                                                                                                                                                           | Output                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| reader   | Fetch uploads, resolve shards via the indexing service with built-in cid.contact repair and direct Storacha carpark location fallback, apply the source URL resolver inline              | `SpaceInventory[]`               |
| planner  | Aggregate inventories, create exactly 2 storage contexts per space, compute costs, write provider/dataset bindings into state                                                            | `MigrationPlan`                  |
| migrator | Fund once, run mixed source-pull/store execution per copy, commit in two phases (sequential dataset creation then bounded-concurrency add-pieces) per copy, emit progress/failure events | `AsyncGenerator<MigrationEvent>` |

---

## Core Invariants

- Resolver is applied only in `reader`
- `planner` is pure apart from writing approved bindings into `MigrationState`
- `migrator` is the only stage that performs FOC writes
- `MigrationState` is mutated in place
- Reader output is treated as immutable once written to `state.spacesInventories`
- Resume behavior is driven only by persisted `MigrationState`
- Every space always has exactly 2 copies
- The 2 copies for a space must bind to 2 distinct providers

---

## State & Resumability

### Runtime State Model

```ts
interface MigrationState {
  version: number
  phase: MigrationPhase
  spaces: Record<SpaceDID, SpaceState>
  spacesInventories: Record<SpaceDID, SpaceInventory>
  readerProgressCursors?: Record<SpaceDID, string>
}

interface SpaceState {
  did: SpaceDID
  phase: SpacePhase
  copies: [SpaceCopyState, SpaceCopyState]
}

interface SpaceCopyState {
  copyIndex: number
  providerId: bigint
  serviceProvider: `0x${string}`
  providerURL: string | null
  dataSetId: bigint | null
  pulled: Set<string>
  committed: Set<string>
  failedUploads: Set<string>
  storedShards: Record<string, string>
}
```

State uses `Set<string>` at runtime for O(1) membership checks and cheap
iteration. Serialization converts these sets to arrays.

State is versioned. `deserializeState()` rejects missing or unknown schema
versions; callers must restart without `--resume` when the persisted format no
longer matches the library.

Per-copy progress semantics:

- `pulled` is shard-keyed and means the piece bytes are already prepared for
  commit
- `storedShards` is shard-keyed and maps one durable piece CID per stored shard
- `committed` is keyed by `shardCid#rootCid`, not just shard CID
- `failedUploads` remains root-keyed

This means the same shard/piece may be pulled or stored once, but committed
once per shard-root pair when one shard belongs to multiple upload roots.

`providerURL` is persisted alongside the copy binding so helper-driven staged
validation and debugging can still probe provider PDP state even before a copy
has an on-chain dataset id.

### Resume Contract

On resume:

1. `deserializeState()` restores persisted progress
2. `buildMigrationInventories()` resumes from `readerProgressCursors`
3. `buildResumeState(state)` extracts pinned provider IDs and existing dataset
   IDs per space copy
4. `createMigrationPlan()` rebuilds exactly 2 contexts per space using those
   bindings
5. `transitionToApproved()` validates that the freshly planned provider and
   dataset bindings still match each persisted copy by `copyIndex`; if any
   drifted, it throws before mutating state
6. `executeMigration()`:
   - skips data movement for shards already fully committed across all roots
   - does not re-pull shards already in a copy's `pulled`
   - reuses the copy's `dataSetId` after a successful commit

On retry:

- `clearFailedUploadsForRetry()` clears persisted `failedUploads` for both
  copies of the selected space
- `committed`, `pulled`, `storedShards`, and provider/dataset bindings are
  preserved
- `space.phase` is reset to `pending` or `migrating` depending on whether any
  durable progress remains

If a caller chooses to validate staged state before resume/retry execution:

- the validation must run after inventories are available and before migrator
  execution starts
- only definitive provider absence (`not_found`) should auto-prune staged
  entries; transient provider/API failures should be reported but preserved
- any corrected state should be checkpointed before the user confirms or aborts
  the run

If reader execution is aborted:

- only fully checkpointed upload-list pages remain persisted
- `MigrationState.phase` stays `reading`
- `reader:complete` is not emitted
- resume continues from the last saved `readerProgressCursors` entry

When `buildMigrationInventories()` runs in explicit-root mode via
`uploadRootsBySpace`:

- the reader skips `upload.list()` entirely and trusts the provided roots for
  that space
- `uploadPageSize` becomes the explicit-root chunk size
- `readerProgressCursors[spaceDID]` stores a synthetic
  `explicit-roots:{nextChunkIndex}` cursor
- resume requires passing `uploadRootsBySpace` again for that space so the
  synthetic cursor can be interpreted against the same root manifest

Reader tuning knobs are part of the public input surface on
`buildMigrationInventories({ options })`:

- `uploadPageSize`
- `shardListConcurrency`
- `checkpointEveryPages`
- `queryClaimsBatchConcurrency`
- `skipIPNIFallback`

These affect throughput and persistence cost only. They do not change the
reader/planner/migrator boundaries or the resume contract:

- page results are still applied to in-memory `MigrationState` immediately
- only `state:checkpoint` events are expected to be persisted by callers
- after an ungraceful stop, up to `checkpointEveryPages - 1` pages or
  explicit-root chunks may be re-processed on resume

Reader fallback behavior also includes:

- `cid.contact` repair requests are bounded by an internal 10-second
  per-request timeout
- `skipIPNIFallback` bypasses the `cid.contact` repair step, but shards still
  missing a `locationURL` after primary claims are still probed via the
  carpark fallback

---

## Planner

The planner always creates 2 contexts per space.

Context creation rules:

- copy `0` is created first
- copy `1` is created second with `excludeProviderIds: [copy0.provider.id]`
- contexts are created with CDN enabled by default
- if the caller provides `providerIds`, the first ID is used for copy `0` and
  the second ID is used for copy `1`
- on resume, pinned provider/dataset bindings win for each copy
- if both copies resolve to the same provider, planning fails fast

Cost rules:

- monthly storage rate always uses the base warm-storage price
- CDN affects only the fixed lockup for fresh datasets
- CDN egress is variable and excluded from upfront plan/retention estimates
- `MigrationPlan.fundingAmount` applies a 5% safety buffer over
  `costs.totalDepositNeeded`

`PerSpaceCost` is copy-based:

```ts
interface PerSpaceCost {
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
```

Space-level numeric fields are sums of the two copy-level values.

---

## Migrator

The migrator executes one space at a time. Within each space:

- `inventory.shards` stay on the normal source-pull path for both copies
- `inventory.shardsToStore` run `store()` on copy 0, then pull from copy 0 on copy 1
- each copy commits through a two-phase flow: Phase 1 runs sequentially until a
  commit establishes the dataset id; Phase 2 pre-packs the remaining pieces and
  runs them concurrently up to `commitConcurrency`
- `executeStoreMigration()` is a thin wrapper that prepares an all-store inventory
  view, then delegates to the same shared `migrateSpace()` executor

Within one space, migrator builds a sparse duplicate-root view:

- one representative shard entry per `shardCid` is used for actual pull/store
  byte movement
- a sparse `multiRootShards` map tracks only shard CIDs that belong to more
  than one upload root
- commit generation expands those representative shards back into one commit
  piece per pending shard-root pair

Internally, migrator execution is split into two layers:

- `runMigration()` owns the outer lifecycle: funding, phase transition, space loop,
  finalization, and summary emission
- `migrateSpace()` owns the deep per-space execution: copy ordering, source pull,
  store flow, commit stream composition, and final per-space checkpointing

### Pull/Commit Semantics

- source pull work is batched and runs concurrently per copy
- store-routed shards are downloaded+stored in batches on copy 0, then pulled in
  batches from copy 0 on copy 1
- pull/store data movement is deduped by `shardCid`; duplicate-root shards do
  not move bytes more than once per copy
- commit progress is root-aware: a prepared shard stays in `pulled` until all
  of its roots are committed for that copy
- pull/store concurrent waves apply settled results incrementally in completion
  order
- pull results checkpoint as each completed pull batch settles
- store results mutate in-memory state and surface failed-root events as each
  settled shard arrives, but durable `state:checkpoint` emission remains
  coalesced to one event per store batch
- store retries treat one attempt as one full `fetch + store()` cycle, so every
  retry recreates the source stream from the reader-resolved `sourceURL`
- secondary/source pull retries presign once, then retry only `context.pull()`
  with the same `extraData`
- when a store-routed root fails on copy 0, any stored shard mappings for that
  root remain durable for retry reuse, but that root is withheld from copy 1
  for the rest of the current run
- commit is copy-scoped and runs in two phases:
  - Phase 1 is sequential and covers dataset-creation batches. It loops until a
    successful commit returns a `dataSetId`, so failed create-dataset batches
    can be retried against the next batch of pieces.
  - Phase 2 keeps batch packing single-writer but lazy: the remaining
    add-pieces batches are packed serially through one shared iterator and
    dispatched concurrently up to `commitConcurrency` via `runConcurrentTasks`
    without materializing the full wave up front.
- commit batching mode is resolved internally per batch:
  - `count` when an internal max-pieces limit is configured
  - `extraData` when count mode is disabled and the encoded `extraData` limit is active
  - `none` when both internal limits are disabled - (one single commit batch)
- in `extraData` mode, the first commit batch may be smaller because it includes
  the dataset-creation payload when `context.dataSetId` is not yet defined
- once the first commit succeeds and the dataset exists, later batches switch to
  add-pieces-only sizing
- failed upload roots are tracked independently per copy; once a root fails,
  later shards under that root are skipped for that copy. Phase 2 reads
  `activeFailedRoots` at pre-pack time only, so failures inside a concurrent
  wave do not retroactively drop pieces that were already packed into sibling
  batches.
- `activeFailedRoots` is transient per run / per copy. It is initialized from
  persisted `failedUploads` on normal resume, and starts empty after
  `clearFailedUploadsForRetry()` is used for a retry run.
- `retryCommitInteractively` is used only for a failing commit batch

### Phase 2 persistence ordering

Once a Phase 2 concurrent wave settles, the completed results are processed in
two passes:

1. **Pass A — persistence and successful settled events.** Every succeeded
   batch whose `result.dataSetId ?? context.dataSetId` is known is recorded to
   state first. If any successes were recorded, one `state:checkpoint` event is
   yielded for the whole settled success wave. After that checkpoint, succeeded
   `migration:commit:settled` events are emitted for those successful batches.
   This all happens before any retry interaction.
2. **Pass B — failed batches only.** Failed batches drive interactive retry. On
   retry win, commits are recorded, a checkpoint is yielded, and the final
   succeeded `migration:commit:settled` event is emitted. On final failure,
   failed roots are recorded and `migration:batch:failed` is yielded.

The guarantee is now durability first and early success visibility: successful
Phase 2 commits are persisted before any retry interaction for failures in the
same wave, and their succeeded `migration:commit:settled` events are emitted
before the failed batches enter retry handling. `commitIndex` remains an
identifier only; callers should not treat it as a stable ordering contract.

### Error Model

| Stage   | Failure class          | Scope                            | Retry                 |
| ------- | ---------------------- | -------------------------------- | --------------------- |
| Presign | `PresignFailedFailure` | Whole pull batch for a copy      | None                  |
| Pull    | `PullFailedFailure`    | Per upload root within the batch | `context.pull()` only |
| Commit  | `CommitFailedFailure`  | One commit batch for one copy    | Interactive retry     |

Operational pull and store failures now carry retry diagnostics on their final
error objects, including attempt count and elapsed time. Upload-quality pull
failures keep the existing per-root event semantics.

---

## Helper Utilities

Helper utilities are exported outside the main pipeline under `./helpers`.

### Cost helpers

- `getStorageRetentionCost()` fetches live pricing and estimates retention cost
- `calculateStorageRetentionCostFromPricing()` performs the same calculation
  from already-fetched pricing inputs

These helpers are read-only and do not interact with `MigrationState`.

### Dataset inspection helpers

- `fetchDataSetPieces()` fetches all active pieces for a dataset and returns the
  provider PDP URL when available
- `listCommittedUploads()` groups committed dataset pieces by `ipfsRootCID`

These helpers are read-only and operate against chain state plus dataset
metadata.

### State validation helpers

- `pruneStagedShards()` probes persisted `pulled` / `storedShards` against the
  provider PDP endpoint and removes only entries the provider definitively no
  longer acknowledges (`not_found`)
- `reconcileMigrationState()` compares persisted state against committed
  dataset pieces and provider PDP staged state, and can correct committed and
  staged drift in place

Helper contracts:

- both helpers mutate `MigrationState` in place
- `pruneStagedShards()` requires inventories plus persisted copy state; it does
  not require planner contexts
- `reconcileMigrationState()` can still validate staged shards for staged-only
  copies via persisted `providerURL` even when `dataSetId` is `null`
- committed-side reconciliation is keyed by `(pieceCID, ipfsRootCID)` and
  rebuilds `copy.committed` as `shardCid#rootCid` pairs
- if a committed dataset piece exists on-chain but is missing `ipfsRootCID`,
  reconciliation reports it as an unverified committed piece and does not
  silently add or remove committed shard-root pairs for that copy
- both helpers may normalize `space.phase` after correcting staged or committed
  state

---

## Events

All stages may yield `state:checkpoint`. Persist on every occurrence.

| Event                      | Stage    | When                                                            | Key fields                                                                                 |
| -------------------------- | -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `reader:space:start`       | reader   | Before the first page of a space                                | `spaceDID`                                                                                 |
| `reader:shard:failed`      | reader   | A shard cannot be resolved                                      | `spaceDID`, `root`, `shard`, `reason`                                                      |
| `reader:space:complete`    | reader   | After the last page of a space                                  | `spaceDID`                                                                                 |
| `reader:complete`          | reader   | After all spaces are read                                       | —                                                                                          |
| `planner:ready`            | planner  | Plan is ready for approval                                      | `plan`                                                                                     |
| `funding:start`            | migrator | Before `fundSync`                                               | `amount`                                                                                   |
| `funding:complete`         | migrator | After `fundSync` succeeds                                       | —                                                                                          |
| `funding:failed`           | migrator | `fundSync` threw; generator terminates                          | `error`                                                                                    |
| `migration:space:start`    | migrator | Before a space starts executing                                 | `spaceDID`                                                                                 |
| `migration:space:complete` | migrator | After a space is finalized                                      | `spaceDID`, `phase`                                                                        |
| `migration:copy:start`     | migrator | Before copy 0 or copy 1 starts                                  | `spaceDID`, `copyIndex`                                                                    |
| `migration:copy:complete`  | migrator | After a copy stops or completes                                 | `spaceDID`, `copyIndex`, `completed`                                                       |
| `migration:phase:start`    | migrator | Before a copy phase starts                                      | `spaceDID`, `copyIndex`, `phase`, `itemCount?`, `batchCount?`                              |
| `migration:phase:complete` | migrator | After a copy phase stops or completes                           | `spaceDID`, `copyIndex`, `phase`, `completed`                                              |
| `migration:batch:failed`   | migrator | A pull/store batch or commit batch produced failed upload roots | `spaceDID`, `copyIndex`, `stage`, `roots`, `error`                                         |
| `migration:commit:failed`  | migrator | A commit batch failed and the caller may choose to retry        | `spaceDID`, `copyIndex`, `commitIndex`, `pieceCount`, `attempt`, `roots`, `error`, `retry` |
| `migration:commit:settled` | migrator | A commit batch finished with success or final failure           | `spaceDID`, `copyIndex`, `commitIndex`, `pieceCount`, `status`, `txHash?`, `error?`        |
| `state:checkpoint`         | all      | Progress became durable                                         | `state`                                                                                    |
| `migration:complete`       | migrator | All spaces processed                                            | `summary`                                                                                  |

`funding:failed` is the only event that terminates execution early.

---

## Key Design Decisions

### 1 Storacha space → 2 FOC datasets

Each space always creates 2 storage contexts on 2 distinct providers, producing
2 independent datasets on success.

### Runtime sets, serialized arrays

State uses sets in memory because migration logic does frequent membership
checks and iteration. Serialization converts them to arrays because JSON has no
set type.

### Size is taken from the location claim when available

The reader prefers `assert/location.range.length` as the real byte size. Piece size is only a
fallback.

### Reader output is final

No later stage re-resolves URLs, sizes, or piece metadata.
