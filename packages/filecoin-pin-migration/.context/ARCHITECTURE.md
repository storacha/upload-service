# Architecture — `@storacha/filecoin-pin-migration`

**Domain:** Storacha-to-FOC migration library
**Last updated:** 2026-04-09

---

## Overview

A **headless pipeline** of three stages separated by explicit data contracts. No stage knows about the UX layer above it. CLI and Console import the library and provide their own rendering.

```
                   ┌───────────────────────────────────────────────────────────────────────────────────┐
                   │  @storacha/filecoin-pin-migration                                                 │
                   │                                                                                   │
  ┌────────────┐   │  ┌───────────┐ SpaceInventory[]    ┌───────────┐  MigrationPlan    ┌──────────┐   │
  │ Storacha   │──▶│  │  reader   │────────────────────▶│  planner  │──────────────────▶│ migrator │   │
  │ client     │   │  └───────────┘                     └───────────┘                   └──────────┘   │
  │ indexer    │   │       │                                  │                               │        │
  └────────────┘   │       │ resolves                         │ computeMigrationCosts         │ yields │
                   │       ▼                                  ▼                               ▼        │
  ┌────────────┐   │  source-url.js                     Synapse SDK                    MigrationEvent  │
  │ Synapse SDK│──▶│                                    (chain reads)                                  │
  │ (FOC)      │   │                                                                                   │
  └────────────┘   └───────────────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┴───────────────┐
                     │  Consumers (not in library)  │
                     │  CLI command / Console page  │
                     └──────────────────────────────┘
```

---

## Responsibilities by Stage

| Stage | Responsibility | Output |
|---|---|---|
| reader | Fetch uploads, resolve shards via indexing service, apply URL resolver inline | `SpaceInventory[]` |
| planner | Aggregate inventories, compute costs via Synapse SDK, produce readiness state | `MigrationPlan` |
| migrator | Execute presign → pull → commit per batch, emit events, update state | `AsyncGenerator<MigrationEvent>` |

---

## Core Invariants

These must never be violated:

- Resolver is applied **only in reader** — planner and migrator never touch URLs
- Planner is **pure** — no mutations, no Synapse writes, safe to call repeatedly
- Migrator is the **only mutation layer** — all FOC writes happen here
- State is **mutated in place** — never copy/spread before passing to state functions
- Reader runs **once** — no re-fetch during migration execution

---

## Dependency Direction

Strict direction, no cycles:

```
index.js
  └─▶ reader.js         reads Storacha, applies resolver inline
  └─▶ source-url.js     URL construction — no other internal deps
  └─▶ planner.js
        └─▶ compute-migration-costs.js   Synapse SDK (read-only chain calls)
        └─▶ state.js                     buildResumeState(), transitionToApproved()
  └─▶ migrator.js
        └─▶ state.js    transitionToFunded, recordCommit, finalizeSpace, finalizeMigration
  └─▶ state.js          standalone — no deps on reader/planner/migrator
  └─▶ errors.js         standalone — no internal deps
```

---

## Cross-Cutting Concerns

### State & Resumability

#### Key Principle

The library is stateless by default.

- It produces and consumes `MigrationState`
- It does NOT persist state
- The caller is fully responsible for:
  - calling `serializeState(state)`
  - storing it (DB, file, localStorage, etc.)
  - restoring it via `deserializeState(...)`

#### MigrationState Semantics

`MigrationState` is the single source of truth for resumability across all stages.

- It is mutated in place by each stage via dedicated state functions
- It tracks long-lived, side-effectful decisions, such as:
  - selected Storage Providers (SPs)
  - committed shards

```ts
interface MigrationState {
  /** Global lifecycle phase (e.g., planning, executing, completed, ...) */
  phase: MigrationPhase

  /** Per-space state (progress, SP bindings, etc.) */
  spaces: Record<SpaceDID, SpaceState>

  /** Reader output keyed by space DID. Completed + in-progress spaces. */
  spacesInventories: Record<SpaceDID, SpaceInventory>

  /** Pagination cursor per space — present only while reading that space. */
  readerProgressCursors?: Record<SpaceDID, string>
}

interface SpaceState {
  did: SpaceDID
  /** space lifecycle (eg.: pending, migrating, ...) */
  phase: SpacePhase
  /** Locks SP selection across runs. Passed back as providerIds on resume. */
  providerId: bigint
  /** Display/audit only. */
  serviceProvider: `0x${string}`
  /** null until first commit; then passed as dataSetIds on resume. */
  dataSetId: bigint | null
  committed: CommittedShards
}
```

`committed.shards` is a flat `Record<shardCid, provider[]>` for O(1) skip checks — no need to walk uploads on every batch entry.

#### Phase FSM

Each stage advances the migration phase by calling a dedicated state function. Upload phase is computed on demand (never stored) via the exported `resolveUploadPhase` consumer utility.

```
Migration:  reading → planning → approved → funded → migrating → complete | incomplete
Space:      pending → complete | incomplete | failed
Upload:     pending → migrating → complete | incomplete   (computed, not stored)
```

| Phase transition | Set by | When |
| --- | --- | --- |
| `reading → planning` | `buildMigrationInventories` | After all spaces read |
| `planning → approved` | `transitionToApproved` (called by planner) | After SP bindings written |
| `approved → funded` | `transitionToFunded` | After `fundSync` succeeds (or skipped if already funded) |
| `funded → migrating` | `executeMigration` | At execution start |
| `migrating → complete\|incomplete` | `finalizeMigration` | After all spaces processed |

---

#### Resume Mechanism

1. Load state from storage via `deserializeState()`
2. Re-read inventories — reader applies cursor/skip logic from `readerProgressCursors` and `spacesInventories`
3. Re-plan: `createMigrationPlan({ inventories, synapse, config, state })` — `buildResumeState(state)` extracts `pinnedProviderIds` and `existingDataSetIds` to force the same SP and compute floor-aware rate deltas
4. Execute: `executeMigration({ plan, state, synapse, config })`

Inside execution, each shard is skipped if already committed to this provider:

```js
(space.committed.shards[shard.cid] ?? []).includes(serviceProvider)
```

---

### Events

All three stages yield `state:checkpoint` — consumers persist on every occurrence regardless of which stage emitted it.

| Event | Stage | When | Key fields |
| --- | --- | --- | --- |
| `reader:space:start` | reader | Before first page of a space | `spaceDID` |
| `reader:space:complete` | reader | After last page of a space | `spaceDID` |
| `state:checkpoint` | reader | After every `upload.list` page | `state` |
| `reader:complete` | reader | After all spaces; `phase → planning` | — |
| `state:checkpoint` | planner | After SP bindings written; `phase → approved` | `state` |
| `plan:ready` | planner | Carries plan for consumer display/approval | `plan` |
| `funding:start` | migrator | Before `fundSync` | `amount: bigint` |
| `funding:complete` | migrator | After `fundSync` succeeds | — |
| `funding:failed` | migrator | If `fundSync` throws — generator terminates | `error` |
| `shard:failed` | migrator | Per shard that fails presign, pull, or commit | `spaceDID`, `root`, `shard`, `error` |
| `state:checkpoint` | migrator | After each batch with ≥1 commit; after each space finalizes | `state` |
| `migration:complete` | migrator | Once, after all spaces | `summary` |

`funding:failed` is the only event that terminates the generator early. All per-shard failures are yielded as `shard:failed` and execution continues.

## Source URL Strategy

`SourceURLResolver` is a single-method interface:

```ts
interface SourceURLResolver {
  resolve(shard: ResolvedShard): string
}
```

Applied once, inline in `resolveShard()`. The resolver receives a partial shard (with `pieceCID` already resolved).

| Resolver | URL format | When to use |
|---|---|---|
| `RoundaboutResolver` | `https://roundabout.web3.storage/piece/<pieceCIDv2>` | Need to confirm if Curio follows redirect to signed R2 URL |
| `ClaimsResolver` | Raw R2 URL from `assert/location` claim | When Curio accepts arbitrary URLs |

**Note:** The `SourceURLResolver` behavior still needs to be validated. We need to align on the best approach for providing piece URLs, and also confirm whether signed URLs have an expiration time.

## Data Flow

### Stage 1 — Reader

This module builds migration inventories for one or more spaces.

For each space, we construct a `SpaceInventory` by:

1. Listing uploads
2. Expanding each upload into shards
3. Resolving each shard into a final, fetchable sourceURL

The output is a fully resolved dataset ready for planning and migration.

#### Data Model

```ts
interface SpaceInventory {
  /** DID identifying the space */
  did: SpaceDID
  /** Uploads where all shards resolved successfully, keyed by root CID */
  uploads: Record<
    /** Root CID of the upload */
    root: string
    /** Fully resolved shards for this upload */
    { shards: ResolvedShard[] }
  >
  /**
   * Uploads excluded from migration because one or more shards could not be
   * resolved. Keyed by root CID; value is the list of shards that failed.
   * Mutually exclusive with uploads.
   */
  failedUploads: Record<string, Array<{ cid: string; reason: string }>>
  /** Number of uploads where all shards resolved (i.e. keys of uploads). */
  totalUploads: number
  /** Total number of resolved shards across all uploads. */
  totalShards: number
  /** Total size (bytes) of all resolved shards */
  totalBytes: bigint
}
```

#### Pipeline

The inventory is built using the following pipeline:

```
storachaClient.capability.upload.list()          [paginated, cursor-based]
  └─▶ for each upload root:
        storachaClient.capability.upload.shard.list(root)   [cursor-paginated]
          └─▶ for each shard:
                indexer.queryClaims({ hashes: [shardMH], kind: 'standard' })
                  └─▶ assert/location → locationURL  (filter out index-blob claims by multihash match)
                  └─▶ assert/equals   → pieceCID     (Filecoin piece commitment)
                resolver.resolve(resolvedShard)             → final sourceURL
```

#### Resolution Semantics

- A shard is considered resolved only if:
  - A valid locationURL is found
  - A valid pieceCID is found
  - `resolver.resolve(...)` succeeds
- If any of the above fails:
  - The upload is added to `failedUploads` (keyed by root CID) with the failing shard and reason
  - The upload is excluded from `uploads` — mutually exclusive
  - If `stopOnError` is true, remaining shards for that upload are not resolved
  - A reason string MUST be provided

**Key invariant:** resolver is applied **inline** as each shard is resolved. `SpaceInventory` shards carry final `sourceURL` values before the planner sees them.

#### Resumability Support

After each `upload.list` page the `MigrationState` is updated with:

- the latest pagination cursor
- the partial SpaceInventory built so far

And a `state:checkpoint` event is emitted.

To resume an interrupted read, pass a previously persisted `MigrationState`. For each space, the reader applies the following logic:

- Spaces already in `state.spacesInventories` with no cursor → skipped entirely
- Spaces with a cursor in `state.readerProgressCursors` → resumed from that page
- Spaces absent from `state.spacesInventories` → started fresh

When spaceDIDs is omitted, all spaces on the client are processed.

#### Events

- reader:space:start    — before the first page of each space
- reader:space:complete — after the last page of each space
- state:checkpoint      — after every upload.list page (persist on this event)
- reader:complete       — after all spaces; state.phase set to 'planning'

### Stage 2 — Planner

The planner creates an `MigrationPlan`, including:

- Aggregated totals (uploads, shards, bytes)
- Cost estimation via the Synapse SDK
- Warnings and readiness status

#### Synapse Context Model

For each space, the planner creates one storage context per copy using the Synapse SDK.
A storage context:

- Encapsulates a set of pieceCIDs and metadata (e.g., space DID, name)
- Is bound to a selected Storage Provider (SP)
- Becomes a dataset on-chain after the migration completes

#### Cost Computation Contract

`computeMigrationCosts` mirrors `calculateMultiContextCosts` in Synapse SDK `manager.ts` but supports heterogeneous per-space sizes. Comments in the file reference manager.ts line numbers — keep in sync when the SDK changes its cost model.

**Note:** Since this library was created to support a one-time migration, this was not considered an issue.

#### Data Model

The `MigrationPlan` isn’t included in the state, since the `MigrationCostResult` contains all the pricing information based on current on-chain values.

```ts
interface MigrationPlan {
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
```

#### Pipeline

```
state.spacesInventories
  └─▶ reduce totals from pre-computed inventory fields
  └─▶ computeMigrationCosts(spaces, synapse, opts)
        └─▶ Step 1: Promise.all(spaces.map → synapse.storage.createContext)   [one context per space]
        └─▶ Step 2: collect existing dataSetIds for on-chain size lookup
        └─▶ Step 3: single parallel chain batch
              accounts(), getServicePrice(), isFwssMaxApproved(), getBlockNumber(), getDataSetSizes()
        └─▶ Step 4: per-space pure math loop — lockup, rate, sybilFee
        └─▶ Step 5: account-level math — deposit needed, buffer, skip-buffer logic
  └─▶ aggregate warnings (cost warnings + skipped shards per space)
```

#### Resumability Support

After `computeMigrationCosts` returns, `transitionToApproved` writes all SP bindings to state in one pass — one `SpaceState` per space, all at once. A single `state:checkpoint` is then emitted.

To resume planning, pass a previously persisted `MigrationState`. The planner uses `buildResumeState` to enforce:

- Spaces with an existing `SpaceState` → reuse the same SP
- Spaces without a `SpaceState` → create a new context and select an SP
- Costs are always recomputed against current chain state and any existing on-chain dataset bindings

### Stage 3 — Migrator

The migrator executes the approved plan: funds once, processes each space's uploads in batches (presign → pull → commit), and yields progress events throughout.

#### Data Model

```ts
interface MigrationSummary {
  /** Total shards committed across all spaces */
  succeeded: number
  /** Shards that failed presign, pull, or commit */
  failed: number
  /** Shards skipped at read time (missing pieceCID or locationURL) */
  skipped: number
  /** Dataset IDs assigned on-chain, one per committed space */
  dataSetIds: bigint[]
  /** Total bytes migrated (from plan.totals.bytes) */
  totalBytes: bigint
  /** Wall-clock duration in ms */
  duration: number
}
```

#### Pipeline

```
executeMigration({ plan, state, synapse, config })
  └─▶ ensureFunding → yield funding:start / funding:complete / funding:failed
  └─▶ state.phase = 'migrating'
  └─▶ for each space in plan.costs.perSpace:
        inventory = state.spacesInventories[spaceDID]
        for each upload → for each batch:
          skip already-committed shards
          processBatch → presign → pull → commit
          yield shard:failed per failure
          recordCommit() + yield state:checkpoint (if ≥1 commit)
        finalizeSpace() + yield state:checkpoint
  finalizeMigration()
  yield migration:complete { summary }
```

`sourceURL` is read directly from `shard.sourceURL` — the migrator never calls any resolver.

#### Error Semantics

| Stage | Failure class | Scope |
|---|---|---|
| Presign | `PresignFailedFailure` | Whole batch — no EIP-712 signature, cannot proceed |
| Pull | `PullFailedFailure` | Per piece — commit proceeds with successfully pulled pieces only |
| Commit | `CommitFailedFailure` | All successfully-pulled pieces in the batch |

`processBatch` never throws — all failures are returned in `BatchResult.failures`. `funding:failed` is the only event that terminates the generator early; all per-shard failures are yielded as `shard:failed` and execution continues.

`stopOnError=true` breaks the batch loop for the **current upload only**. The next upload in the same space and all other spaces continue normally.

#### Resumability Support

On resume, `executeMigration` receives the deserialized `MigrationState` which already contains SP and dataset bindings written by the planner's `transitionToApproved`. For each batch:

- Shards already in `space.committed.shards[cid]` for this provider are filtered out (`pending` becomes empty → batch skipped)
- `dataSetId` is restored from `space.dataSetId` on the first commit (`recordCommit` sets it if null)
- If `state.phase` is already `'funded'`, `ensureFunding` skips the transaction (no duplicate deposit)

#### Events

| Event | When | Key fields |
|---|---|---|
| `funding:start` | Before `fundSync` call | `amount: bigint` |
| `funding:complete` | After `fundSync` succeeds | — |
| `funding:failed` | If `fundSync` throws | `error: Error` — generator terminates |
| `shard:failed` | Per shard that fails presign, pull, or commit | `spaceDID`, `root`, `shard`, `error` |
| `state:checkpoint` | After each batch with ≥1 commit; after each space finalizes | `state: MigrationState` |
| `migration:complete` | Once, after all spaces | `summary: MigrationSummary` |

---

## Key Design Decisions

### Resolver applied at reader level

The reader applies the resolver inline in `resolveShard()`. `SpaceInventory` shards carry final `sourceURL` values before any other stage runs. The planner only reduces over inventories for totals — it never copies or touches URLs. The migrator reads `shard.sourceURL` directly.

**Why:** Single-pass enumeration; URL strategy is invisible to planner and migrator; simpler testing (planner tests never need a resolver).

### CIDs are strings throughout plan/state

`ResolvedShard.cid`, `pieceCID`, and upload roots are `string` throughout. Converted to typed SDK values only at the Synapse boundary in `migrator.js` via `toPieceCID()`.

**Why:** Keeps serialization trivial and avoids IPLD codec imports in planner/state.

### State mutated in place

`recordCommit`, `finalizeSpace`, `finalizeMigration`, `transitionToFunded` all mutate `MigrationState` directly. The same object is passed across the entire generator lifecycle and yielded in `state:checkpoint`.

**Why:** Copying/spreading before these calls breaks the consumer's reference — the caller persists state by reference.

### 1 Storacha space → 1 FOC dataset

One `StorageContext` per space. All uploads in a space share one dataset.

**Why:** The sybil fee (0.1 USDFC) is paid once per space, not per upload. Minimizes fees and complexity.

### `computeMigrationCosts` mirrors Synapse SDK `manager.ts`

The SDK's `calculateMultiContextCosts` applies one `dataSize` to every context. Migration needs per-space sizes, so the calculation is replicated. Comments reference `manager.ts` line numbers. When the SDK changes its cost model, this file must be updated to match.

---

## Non-Goals

- No internal persistence (caller owns state)
- No UI rendering or output
- No retry orchestration (caller decides retry policy)
- No re-fetching during execution
- No mutation inside planner

---

## Anti-Patterns

**Library owns I/O:** The library never writes to disk. It accepts state as input and yields events as output. CLI persists state to a JSON file; Console persists to IndexedDB or localStorage.

**Planner executes mutations:** The planner only calls read-only Synapse APIs. All FOC mutations (funding, pull, commit) live in the migrator. The planner is safe to call repeatedly without side effects or gas cost.

**Reader re-queried during migration:** The reader runs once, upfront. The migrator works only from the resolved plan. Re-querying the indexing service during the pull/commit loop would introduce non-determinism.

**Cross-stage URL resolution:** Never re-resolve URLs in planner or migrator. All URL decisions are final when `SpaceInventory` is built.

---

## Extension Points

- `SourceURLResolver` — pluggable, pass any implementation to `buildMigrationInventories()`
- Batch size — controlled via `config.batchSize`
- Concurrency model — future
- Multi-chain support — future

---

## Scalability Notes

| Concern | How it's handled |
|---|---|
| Batch size | `batchSize` option (default 50 pieces). Smaller = more transactions + fees. Larger = risk of SP timeout. |
| Context creation failure | `computeMigrationCosts` fails fast on any `createContext` rejection — a partial plan is worse than no plan |

---

## When to Update This Document

**Update when:**

- a stage responsibility changes
- a new invariant is introduced
- data contracts (types, fields) change
- execution model changes (event order, error semantics)

**Do not update for:**

- roadmap changes
- minor refactors without behavior impact
- test infrastructure changes
