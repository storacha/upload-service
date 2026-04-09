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
        └─▶ state.js                     buildResumeState()
  └─▶ migrator.js
        └─▶ state.js    transitionToFunded, recordCommit, finalizeSpace, finalizeMigration
  └─▶ state.js          standalone — no deps on reader/planner/migrator
  └─▶ errors.js         standalone — no internal deps
```

---

## Data Flow

### Stage 1 — Reader

```
storachaClient.capability.upload.list()          [paginated, cursor-based]
  └─▶ for each upload root:
        storachaClient.capability.upload.shard.list(root)   [cursor-paginated]
          └─▶ for each shard:
                indexer.queryClaims({ hashes: [shardMH], kind: 'standard' })
                  └─▶ assert/location → locationURL  (filter out index-blob claims by multihash match)
                  └─▶ assert/equals   → pieceCID     (Filecoin piece commitment codec 0xf101)
                resolver.resolve(partial)             → final sourceURL
```

Key invariant: resolver is applied **inline** as each shard is resolved. `SpaceInventory` shards carry final `sourceURL` values before the planner sees them.

### Stage 2 — Planner

```
inventories
  └─▶ shallow-copy inventories → PlanSpace[]   (skippedShards is deep-copied; do not mutate)
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

`computeMigrationCosts` mirrors `calculateMultiContextCosts` in Synapse SDK `manager.ts` but supports heterogeneous per-space sizes. Comments in the file reference `manager.ts` line numbers — keep in sync when the SDK changes its cost model.

### Stage 3 — Migrator

```
executeMigration({ plan, state, synapse, config })
  └─▶ ensureFunding → yield funding:start / funding:complete / funding:failed
  └─▶ for each perSpaceCost in plan.costs.perSpace:
        migrateSpace()
          └─▶ for each upload in spacePlan.uploads:
                for each batch (batchSize shards):
                  filter already-committed shards (state.committed[shardCid])
                  processBatch({ batch, context, signal })
                    └─▶ 1. presign  → context.presignForCommit(pieces)
                    └─▶ 2. pull     → context.pull({ pieces, from: (cid) => sourceURL, extraData })
                                       partition pullResult.pieces → succeeded / pullFailures
                    └─▶ 3. commit   → context.commit({ pieces: succeeded, extraData })
                  yield shard:failed per failure
                  recordCommit() for each committed shard
                  yield state:checkpoint (if ≥1 commit)
                  if stopOnError && failures → break (upload-level only)
          finalizeSpace(state, spaceDID)
          yield state:checkpoint  (terminal space phase)
  finalizeMigration(state)
  yield migration:complete
```

`sourceURL` is read directly from `entry.shard.sourceURL` — the migrator never calls any resolver.

---

## Data Contracts

### SpaceInventory

| Field | Type | Source |
|---|---|---|
| `did` | `SpaceDID` | `client.setCurrentSpace()` |
| `uploads` | array | `upload.list()` + `upload.shard.list()` |
| `skippedShards` | array | Shards missing pieceCID or locationURL |
| `totalUploads` | `number` | `uploads.length` after pagination |
| `totalShards` | `number` | Accumulated as resolved shards are pushed |
| `totalBytes` | `bigint` | Accumulated from `result.ok.sizeBytes` — piece size, not CAR size |

`totalBytes` is derived from `Piece.fromLink().size` — piece sizes, not raw CAR file sizes. Do not confuse these.

### MigrationPlan

```ts
{
  spaces: PlanSpace[]          // shallow copy of inventories — final sourceURLs already set
  totals: { uploads, shards, bytes }
  costs: MigrationCostResult   // perSpace[] with live StorageContext handles
  warnings: string[]
  ready: boolean               // totalDepositNeeded === 0n && FWSS approved
}
```

`PlanSpace extends SpaceInventory {}` — structurally identical, lifecycle distinction only. No fields exist in one that don't exist in the other.

### MigrationState

```ts
interface MigrationState {
  phase: MigrationPhase    // approved → funded → migrating → complete | incomplete
  spaces: Record<SpaceDID, SpaceState>
  committed: Record<string, string[]>   // shardCid → committed provider addresses
}
```

`committed` is a flat map for O(1) skip check — no need to walk `spaces → uploads` on every batch entry.

### Phase FSM

```
Migration:  approved → funded → migrating → complete | incomplete
Space:      pending  → complete | incomplete | failed
Upload:     pending  → migrating → complete | incomplete
```

`resolveUploadPhase(upload, final)` — the `final` flag is critical:
- `final=false` during batch loop: partial progress → `migrating`
- `final=true` in `finalizeSpace`: partial progress → `incomplete`

---

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

---

## Resume Mechanism

1. Load state from disk via `deserializeState()`
2. Re-read inventories (reader runs fresh)
3. Re-plan: `createMigrationPlan(inventories, synapse, config, state)` — `buildResumeState(state)` extracts `pinnedProviderIds` and `existingDataSetIds` from persisted state to force the same SP and compute floor-aware rate deltas
4. Execute: `executeMigration({ plan, state, synapse, config })`

Inside execution, each shard is skipped if already committed:

```js
state.committed[shard.cid]?.includes(serviceProvider)
```

---

## Events

| Event | When | Key fields |
|---|---|---|
| `funding:start` | Before `fundSync` | `amount: bigint` |
| `funding:complete` | After `fundSync` lands | — |
| `funding:failed` | If `fundSync` throws | `error: Error` — generator terminates |
| `shard:failed` | Per shard that fails presign, pull, or commit | `spaceDID`, `root`, `shard`, `error` |
| `state:checkpoint` | After each batch with ≥1 commit, and after each space finalizes | `state: MigrationState` |
| `migration:complete` | Once, after all spaces | `summary: MigrationSummary` |

`funding:failed` is the only event that terminates the generator early. All per-shard failures are yielded as `shard:failed` — the generator continues.

---

## Error Model

| Stage | Failure class | Scope |
|---|---|---|
| Presign | `PresignFailedFailure` | Whole batch — no EIP-712 signature, cannot proceed |
| Pull | `PullFailedFailure` | Per piece — commit proceeds with successfully pulled pieces only |
| Commit | `CommitFailedFailure` | All successfully pulled pieces in the batch |

`processBatch` never throws — it always returns a `BatchResult`. Failures surface as `shard:failed` events.

`stopOnError=true` breaks out of the **batch loop for the current upload only**. The next upload and other spaces continue.

---

## Key Design Decisions

### Resolver applied at reader level

The reader applies the resolver inline in `resolveShard()`. `SpaceInventory` shards carry final `sourceURL` values before any other stage runs. The planner shallow-copies inventories without touching URLs. The migrator reads `entry.shard.sourceURL` directly.

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

**Library owns I/O:** The library never writes to disk or prints output. It accepts state as input and yields events as output. CLI persists state to a JSON file; Console persists to IndexedDB or localStorage.

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
| Resume after failure | `state.committed` flat map enables O(1) skip check per shard per provider |
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
