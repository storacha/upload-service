# Architecture — `@storacha/filecoin-pin-migration`

**Domain:** Storacha-to-FOC migration library  
**Last updated:** 2026-04-15

---

## Overview

A headless three-stage pipeline with explicit data contracts:

```
Reader → Planner → Migrator
```

- `reader` builds `SpaceInventory[]`
- `planner` computes a `MigrationPlan`
- `migrator` executes the approved plan and mutates `MigrationState`

The library owns no UX or persistence. Callers persist `MigrationState` on `state:checkpoint` events and render progress however they want.

---

## Responsibilities by Stage

| Stage | Responsibility | Output |
|---|---|---|
| reader | Fetch uploads, resolve shards via the indexing service, apply the source URL resolver inline | `SpaceInventory[]` |
| planner | Aggregate inventories, compute costs via Synapse SDK, bind providers/datasets into state | `MigrationPlan` |
| migrator | Fund once, pull shards in batches, commit once per space, emit progress/failure events | `AsyncGenerator<MigrationEvent>` |

---

## Core Invariants

- Resolver is applied only in `reader`
- `planner` is pure apart from writing approved bindings into `MigrationState`
- `migrator` is the only stage that performs FOC writes
- `MigrationState` is mutated in place
- Reader output is treated as immutable once written to `state.spacesInventories`
- Resume behavior is driven only by persisted `MigrationState`

---

## Dependency Direction

```
index.js
  └─▶ reader.js
  └─▶ source-url.js
  └─▶ planner.js
        └─▶ compute-migration-costs.js
        └─▶ state.js
  └─▶ migrator.js
        └─▶ state.js
  └─▶ state.js
  └─▶ errors.js
```

`state.js` and `errors.js` remain standalone. No stage should depend on another stage's internals.

---

## State & Resumability

### Key Principle

The library is stateless by default:

- it consumes and mutates `MigrationState`
- it does not persist that state
- the caller serializes/deserializes it

### Runtime State Model

```ts
interface MigrationState {
  phase: MigrationPhase
  spaces: Record<SpaceDID, SpaceState>
  spacesInventories: Record<SpaceDID, SpaceInventory>
  readerProgressCursors?: Record<SpaceDID, string>
}

interface SpaceState {
  did: SpaceDID
  phase: SpacePhase
  providerId: bigint
  serviceProvider: `0x${string}`
  dataSetId: bigint | null
  pulled: Set<string>
  committed: Set<string>
  failedUploads: Set<string>
}
```

State uses `Set<string>` at runtime for O(1) membership checks and cheap iteration. Serialization converts these sets to string arrays.

### Phase FSM

```
Migration: reading → planning → approved → funded → migrating → complete | incomplete
Space:     pending → complete | incomplete | failed
Upload:    pending → migrating → complete | incomplete   (computed, not stored)
```

Important transitions:

- `buildMigrationInventories` moves migration to `planning`
- `createMigrationPlan` calls `transitionToApproved`
- `executeMigration` calls `transitionToFunded` after funding succeeds
- `recordPull` checkpoints successful pulls before commit
- `recordCommit` moves shard CIDs from `pulled` to `committed`
- `finalizeSpace` and `finalizeMigration` resolve final phases

### Resume Contract

On resume:

1. `deserializeState()` restores persisted progress
2. `buildMigrationInventories()` resumes from `readerProgressCursors` and skips completed spaces
3. `createMigrationPlan()` rebuilds costs using `buildResumeState(state)` so provider/dataset bindings remain stable
4. `executeMigration()`:
   - skips shards already in `space.committed`
   - does not re-pull shards already in `space.pulled`
   - reuses `space.dataSetId` once a final commit has succeeded

---

## Events

All stages may yield `state:checkpoint`. Persist on every occurrence.

| Event | Stage | When | Key fields |
|---|---|---|---|
| `reader:space:start` | reader | Before the first page of a space | `spaceDID` |
| `reader:shard:failed` | reader | A shard cannot be resolved | `spaceDID`, `root`, `shard`, `reason` |
| `reader:space:complete` | reader | After the last page of a space | `spaceDID` |
| `reader:complete` | reader | After all spaces are read | — |
| `planner:ready` | planner | Plan is ready for approval | `plan` |
| `funding:start` | migrator | Before `fundSync` | `amount` |
| `funding:complete` | migrator | After `fundSync` succeeds | — |
| `funding:failed` | migrator | `fundSync` threw; generator terminates | `error` |
| `migration:batch:failed` | migrator | A pull batch or final commit produced failed upload roots | `spaceDID`, `stage`, `roots`, `error` |
| `migration:commit:failed` | migrator | The final commit failed and the caller may choose to retry | `spaceDID`, `attempt`, `roots`, `error`, `retry` |
| `state:checkpoint` | all | Progress became durable | `state` |
| `migration:complete` | migrator | All spaces processed | `summary` |

`funding:failed` is the only event that terminates execution early.

---

## Stage 1 — Reader

The reader builds one `SpaceInventory` per space.

For each `upload.list` page:

1. list shards for every upload root in the page
2. make one batched `queryClaims` call for every shard multihash in that page
3. extract:
   - `pieceCID` from `assert/equals`
   - `locationURL` from `assert/location`
   - `sizeBytes` from `assert/location.range.length` when present, otherwise fall back to the piece size
4. apply the configured `SourceURLResolver`
5. append resolved results into `state.spacesInventories[did]`

### Reader Invariants

- one `queryClaims` request per `upload.list` page
- resolver is applied inline while constructing `ResolvedShard`
- failed shard resolution emits `reader:shard:failed`
- failed upload roots are recorded only in the inventory/state, not per-shard

---

## Stage 2 — Planner

The planner reduces inventories into totals and computes costs with Synapse SDK.

It:

- creates one storage context per space
- reuses provider and dataset bindings from resume state when present
- computes deposit and readiness
- writes approved per-space bindings into `state.spaces`

`MigrationPlan` is not persisted. It is recomputed against current chain state on every run.

---

## Stage 3 — Migrator

The migrator executes an approved plan in three broad steps:

1. ensure funding
2. for each space, pull pending shards in batches
3. after all pull batches finish, commit all pulled shards for that space in one final commit

### Execution Model

```
executeMigration({ plan, state, synapse, config })
  └─▶ ensureFunding(plan.fundingAmount)
  └─▶ state.phase = 'migrating'
  └─▶ for each space:
        inventory = state.spacesInventories[spaceDID]
        pending = inventory.shards excluding space.committed and space.pulled
        failedRoots = Set(space.failedUploads)
        run presign+pull over pending batches with configurable pull concurrency
        reconcile failed roots across all batch results
        checkpoint surviving pulled shards with recordPull()
        build final commit set from space.pulled
        commit all pulled shards for the space in one call
        on success: recordCommit() for each committed shard
        finalizeSpace()
  └─▶ finalizeMigration()
```

### Pull/Commit Semantics

- batches are only for presign + pull
- commit is space-scoped, not batch-scoped
- `stopOnError` is enforced via upload-root tracking in `failedRoots`
- pull failures and final commit failures are reported as migration events
- `retryCommitInteractively` is used only for the final per-space commit

### Error Model

| Stage | Failure class | Scope | Retry |
|---|---|---|---|
| Presign | `PresignFailedFailure` | Whole pull batch | None |
| Pull | `PullFailedFailure` | Per upload root within the batch | `p-retry` |
| Commit | `CommitFailedFailure` | Final per-space commit | Interactive retry |

---

## Source URL Strategy

`SourceURLResolver` is applied exactly once in `reader.js`.

Available implementations:

- `ClaimsResolver` → raw location claim URL
- `RoundaboutResolver` → roundabout URL for a piece CID

Planner and migrator must treat `shard.sourceURL` as final.

---

## Key Design Decisions

### 1 Storacha space → 1 FOC dataset

Each space maps to one Synapse storage context and one eventual dataset.

### Runtime sets, serialized arrays

State uses sets in memory because migration logic does frequent membership checks and iteration. Serialization converts them to arrays because JSON has no set type.

### Size is taken from the location claim when available

Piece CID derivation does not account for padding, so the reader prefers `assert/location.range.length` as the real byte size. Piece size is only a fallback.

### Reader output is final

No later stage re-resolves URLs, sizes, or piece metadata.

---

## Non-Goals

- internal persistence
- UI rendering
- re-fetching claims during migration execution
- hidden state outside `MigrationState`

---

## When to Update This Document

Update this document when:

- state fields change
- event contracts change
- the execution model changes
- stage responsibilities move
