# `@storacha/filecoin-pin-migration`

Headless library for migrating Storacha content to Filecoin on Chain (FOC).

For most users, the recommended entrypoint is the Storacha CLI:

```bash
storacha space migrate
```

Use this library directly only when you need custom orchestration, persistence,
approval UX, or debugging/integration hooks around the migration flow.

---

## What This Package Provides

- a resumable three-stage migration pipeline:
  - reader
  - planner
  - migrator
- exactly 2 copies per space on 2 distinct providers
- serializable `MigrationState` for checkpointing and resume
- helper utilities for:
  - storage retention cost estimation
  - committed dataset inspection
  - staged-shard validation
  - state reconciliation/debugging

---

## Installation

```bash
npm install @storacha/filecoin-pin-migration
```

---

## Recommended Usage

If you just want to migrate a Storacha space, use the CLI command:

```bash
storacha space migrate
```

The CLI already handles:

- wallet/account preflight
- state-file persistence
- resume and retry flows
- plan display and approval
- staged-shard cleanup before resume/retry
- progress rendering and failure reporting

This library is better suited to:

- custom applications embedding the migration flow
- alternate persistence layers
- custom approval/funding UX
- debugging and audit tooling

---

## Migration Model

The library uses a strict three-stage pipeline:

```text
Reader -> Planner -> Migrator
```

### 1. Reader

`buildMigrationInventories()` walks one or more spaces, paginates uploads,
lists shards, resolves claims, and builds immutable `SpaceInventory` snapshots.

Reader output includes:

- upload roots that resolved successfully
- skipped upload roots
- `shards` for normal source-pull migration
- `shardsToStore` for shards that must go through the store flow
- total byte counts used by planning

The reader checkpoints progress into `state.spacesInventories` after each page.

Reader tuning options are available through
`buildMigrationInventories({ options })`:

- `uploadPageSize`
- `shardListConcurrency`
- `checkpointEveryPages`
- `queryClaimsBatchConcurrency`
- `skipIPNIFallback`

These are intended for large-space tuning. Keep `uploadPageSize` modest unless
you have benchmark data: larger pages increase memory use and the amount of
claim-resolution work done before the next persisted checkpoint. Raising
`checkpointEveryPages` reduces checkpoint I/O, but after an ungraceful stop the
reader may need to re-process up to `checkpointEveryPages - 1` pages on resume.
Keep `queryClaimsBatchConcurrency` conservative unless benchmarks show primary
claims resolution is a meaningful fraction of per-page reader time.
`skipIPNIFallback` bypasses the `cid.contact` repair step, but shards still
missing a `locationURL` after primary claims are still probed via the carpark
fallback. Independently of that option, `cid.contact` requests now use an
internal 10-second per-request timeout.

### 2. Planner

`createMigrationPlan()` reads the inventories from state, creates exactly 2
storage contexts per space, computes costs, and writes the selected
provider/dataset bindings into `MigrationState`.

The planner produces a `MigrationPlan` containing:

- per-space totals
- per-copy and per-space cost breakdowns
- warnings
- readiness/funding information
- `fundingAmount`, which includes a 5% safety buffer over the required deposit

### 3. Migrator

`executeMigration()` funds once, then executes one space at a time.

Within a space:

- `inventory.shards` stay on the normal source-pull path for both copies
- `inventory.shardsToStore` are stored on copy 0, then pulled from copy 0 on
  copy 1
- commits run in two phases:
  - Phase 1: sequential until the dataset exists
  - Phase 2: bounded-concurrency add-pieces batches

The migrator yields `MigrationEvent`s for:

- state checkpoints
- phase/copy/space progress
- batch failures
- commit retry decisions
- final migration summary

---

## Data Path

Most shards are migrated without passing through the caller machine:

- source-routed shards are pulled directly by the storage provider from the
  reader-resolved `sourceURL`

Some shards may require the store flow:

- `shardsToStore` are fetched and stored client-side on copy 0
- copy 1 then pulls those stored pieces from copy 0

So the library supports both:

- direct provider pulls
- mixed direct-pull + store-assisted migration

---

## State, Checkpoints, and Resume

The library mutates a single `MigrationState` in place. Callers are expected to
persist it on every `state:checkpoint` event.

Typical lifecycle:

1. create or load state
2. run reader and persist checkpoints
3. run planner and persist the approved bindings
4. optionally validate staged state before resume/retry
5. run migrator and persist every checkpoint

Resume is driven entirely by persisted state:

- committed shard CIDs are not re-committed
- pulled shard CIDs are not re-pulled
- stored shard mappings are reused
- provider and dataset bindings are pinned per copy

The core state helpers are:

- `createInitialState()`
- `serializeState()`
- `deserializeState()`
- `clearFailedUploadsForRetry()`

---

## Core Exports

Main pipeline:

```js
import {
  createInitialState,
  buildMigrationInventories,
  createMigrationPlan,
  executeMigration,
  serializeState,
  deserializeState,
} from '@storacha/filecoin-pin-migration'
```

Additional advanced exports:

- `computeMigrationCosts()` for lower-level planning/cost usage
- `ensureFunding()` for explicit funding orchestration
- `executeStoreMigration()` for the standalone all-store execution path
- `RoundaboutResolver`, `ClaimsResolver`, and `createResolver()` for custom
  reader integration

---

## Helper Exports

Helper utilities are exported separately:

```js
import {
  getStorageRetentionCost,
  calculateStorageRetentionCostFromPricing,
  fetchDataSetPieces,
  listCommittedUploads,
  pruneStagedShards,
  reconcileMigrationState,
} from '@storacha/filecoin-pin-migration/helpers'
```

### Cost helpers

- `getStorageRetentionCost()` fetches live pricing and estimates storage
  retention cost
- `calculateStorageRetentionCostFromPricing()` calculates the same from
  already-fetched pricing inputs

### Dataset inspection

- `fetchDataSetPieces()` fetches the active pieces for a dataset together with
  the provider PDP URL
- `listCommittedUploads()` groups committed dataset pieces by upload root

### Resume / debugging helpers

- `pruneStagedShards()` validates persisted staged shards (`pulled` /
  `storedShards`) against the provider PDP endpoint and removes only entries the
  provider definitively no longer has
- `reconcileMigrationState()` compares persisted state against committed dataset
  contents and staged provider state to identify/correct drift

These helpers are useful for:

- debugging persisted `migration.json` files
- validating resume state before continuing
- building custom audit tooling

---

## Minimal Integration Shape

At a high level, custom consumers should:

1. create or deserialize `MigrationState`
2. run `buildMigrationInventories()` and persist every `state:checkpoint`
3. run `createMigrationPlan()` and persist the approved bindings checkpoint
4. optionally run helper-based staged-state validation
5. run `executeMigration()` and persist every `state:checkpoint`

The library is intentionally headless:

- it does not own file persistence
- it does not own approval UX
- it does not own terminal/log rendering

That is why the CLI is the recommended default for end users, while this
package is the lower-level integration surface.

---

## License

Apache-2.0 OR MIT
