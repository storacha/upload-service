# `@storacha/filecoin-pin-migration`

Headless library for migrating Storacha content to Filecoin on Chain (FOC) without re-uploading data.

Filecoin storage providers pull your data directly from Storacha's storage via the Curio pull API. Your data never moves through your machine.

---

## How it works

Migration runs in three sequential phases:

```
Reader → Planner → Migrator
```

### 1. Reader — inventory

Walks every space on the Storacha client, paginates all uploads, and for each shard queries the indexing service to resolve:

- `pieceCID` — required by the Filecoin storage provider
- `sourceURL` — the URL the SP will pull from (resolved by the chosen strategy)
- `sizeBytes` — derived from the piece itself

The result is a `SpaceInventory` per space: a structured list of every upload and its resolved shards, with counts and byte totals pre-computed.

### 2. Planner — cost calculation and approval

Takes space inventories, creates one StorageContext per space per copy (each context binds a payer, provider, and on-chain dataset via the Synapse SDK), and computes the single USDFC deposit needed across all spaces. Returns a MigrationPlan the consumer can display for user approval before any on-chain action.

The plan carries:

- Per-space upload/shard/byte totals
- Per-space storage cost breakdown (lockup, rate, sybil fee)
- Account-level deposit needed and approval requirements
- Live `StorageContext` handles — passed directly to the migrator

### 3. Migrator — execution

Executes the approved plan as an `AsyncGenerator`. Yields `MigrationEvent` objects the consumer handles at its own pace: persisting state to disk, displaying progress, logging failures.

Each space is processed upload-by-upload in configurable batches. Each batch runs three stages:

1. **Presign** — EIP-712 signature for the batch
2. **Pull** — SP fetches pieces from the `sourceURL`; pieces are partitioned into succeeded/failed
3. **Commit** — on-chain registration of successfully pulled pieces and creation of datasets

State is checkpointed after every batch with at least one commit, enabling crash recovery.

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
│           buildMigrationInventory(ies)                     │
│  + IndexingServiceReader (queryClaims)                     │
│  + SourceURLResolver (ClaimsResolver | RoundaboutResolver) │
│                                                            │
│  → SpaceInventory[]  (uploads, shards, totals — final URLs)│
└────────────────────┬───────────────────────────────────────┘
                     │ inventories
                     ▼
┌────────────────────────────────────────────────────────────┐
│                createMigrationPlan()                       │
│  + Synapse SDK (createContext per space, chain reads)      │
│                                                            │
│  → MigrationPlan  (spaces, costs, totals, ready flag)      │
└────────────────────┬───────────────────────────────────────┘
                     │ plan + createApprovalState()
                     ▼
┌────────────────────────────────────────────────────────────┐
│              executeMigration()  [AsyncGenerator]          │
│  presign → pull → commit  (per batch, per upload, per space│
│  checkpoints → MigrationState  (serializable, resumable)  │
│                                                            │
│  yields: funding:start/complete/failed                     │
│          shard:failed                                      │
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

## Usage

TODO
