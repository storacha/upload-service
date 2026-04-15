# `@storacha/filecoin-pin-migration`

Headless library for migrating Storacha content to Filecoin on Chain (FOC) without re-uploading data.

Filecoin storage providers pull your data directly from Storacha's storage via the Curio pull API. Your data never moves through your machine.

---

## How it works

Migration runs in three sequential phases:

```
Reader → Planner → Migrator
```

All three phases are `AsyncGenerator`s that yield `MigrationEvent` objects. A single `MigrationState` is created upfront and threaded through all stages — consumers persist it on every `state:checkpoint` event to enable crash recovery.

### 1. Reader — inventory

Walks every space on the Storacha client, paginates all uploads, and per page batch-queries the indexing service once to resolve all shards in that page:

- `pieceCID` — required by the Filecoin storage provider
- `sourceURL` — the URL the SP will pull from (resolved by the chosen strategy)
- `sizeBytes` — derived from the `assert/location` claim range length when present, otherwise from the piece claim

The result is a `SpaceInventory` per space: a flat list of every resolved shard (each carrying its upload root), the list of successful upload root CIDs, and the list of failed upload root CIDs. Inventories are written into `state.spacesInventories` as each page completes.

### 2. Planner — cost calculation and approval

Takes space inventories, creates one `StorageContext` per space (each context binds a payer, provider, and on-chain dataset via the Synapse SDK), and computes the single USDFC deposit needed across all spaces. Writes SP bindings to state and yields a `planner:ready` event carrying a `MigrationPlan` the consumer can display for user approval before any on-chain action.

The plan carries:

- Per-space upload/shard/byte totals
- Per-space storage cost breakdown (lockup, rate, sybil fee)
- Account-level deposit needed and approval requirements
- `fundingAmount` — the deposit plus a 10% safety buffer, surfaced in `plan.warnings` before the user approves
- A `ready` flag — false if a deposit or FWSS approval is required

### 3. Migrator — execution

Executes the approved plan as an `AsyncGenerator`. Yields `MigrationEvent` objects the consumer handles at its own pace: persisting state to disk, displaying progress, logging failures.

Shards from all uploads in a space are batched together (cross-upload) from the flat `inventory.shards` array, maximising batch utilisation regardless of how many shards each upload has. Pull work runs in concurrent batches, then all successfully pulled shards for the space are committed together once.

1. **Presign** — EIP-712 signature scoped to the exact pieces in the batch
2. **Pull** — SP fetches pieces from `sourceURL`; retried up to 3 times with exponential backoff; failures are tracked by upload root
3. **Commit** — one final on-chain registration for all pulled pieces in the space; failed commits can be retried interactively by the caller

State is checkpointed after pulled progress is recorded and after successful final commits. Pulled-but-not-yet-committed shards are persisted so resume can skip re-pulling them.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     @storacha/client                       │
│  spaces() / upload.list() / upload.shard.list()            │
└────────────────────┬───────────────────────────────────────┘
                     │ paginate uploads + shards
                     ▼
┌────────────────────────────────────────────────────────────┐
│           buildMigrationInventories()                      │
│  + IndexingServiceReader (queryClaims)                     │
│  + SourceURLResolver (ClaimsResolver | RoundaboutResolver) │
│                                                            │
│  → state.spacesInventories  (uploads, shards, final URLs)  │
└────────────────────┬───────────────────────────────────────┘
                     │ state.spacesInventories
                     ▼
┌────────────────────────────────────────────────────────────┐
│                createMigrationPlan()                       │
│  + Synapse SDK (createContext per space, chain reads)      │
│                                                            │
│  → planner:ready  (costs, totals, ready flag)              │
└────────────────────┬───────────────────────────────────────┘
                     │ plan + state (SP bindings written)
                     ▼
┌────────────────────────────────────────────────────────────┐
│              executeMigration()  [AsyncGenerator]          │
│  pull batches → final commit  (per space)                  │
│  checkpoints → MigrationState  (serializable, resumable)   │
│                                                            │
│  yields: funding:start/complete/failed                     │
│          migration:batch:failed                            │
│          migration:commit:failed                           │
│          state:checkpoint                                  │
│          migration:complete                                │
└────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- A funded USDFC wallet — required for storage payment lockup
- FIL for gas — required for on-chain transactions
- An authenticated `@storacha/client` instance with access to the spaces to migrate
- An initialized `@filoz/synapse-sdk` `Synapse` instance
- Access to an indexing service (for resolving shard claims)

---

## Installation

```bash
npm install @storacha/filecoin-pin-migration
```

---

## License

Apache-2.0 OR MIT
