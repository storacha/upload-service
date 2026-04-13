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

Walks every space on the Storacha client, paginates all uploads, and for each shard queries the indexing service to resolve:

- `pieceCID` — required by the Filecoin storage provider
- `sourceURL` — the URL the SP will pull from (resolved by the chosen strategy)
- `sizeBytes` — derived from the piece itself

The result is a `SpaceInventory` per space: a structured list of every upload and its resolved shards, with counts and byte totals pre-computed. Inventories are written into `state.spacesInventories` as each page completes.

### 2. Planner — cost calculation and approval

Takes space inventories, creates one `StorageContext` per space (each context binds a payer, provider, and on-chain dataset via the Synapse SDK), and computes the single USDFC deposit needed across all spaces. Writes SP bindings to state and yields a `plan:ready` event carrying a `MigrationPlan` the consumer can display for user approval before any on-chain action.

The plan carries:

- Per-space upload/shard/byte totals
- Per-space storage cost breakdown (lockup, rate, sybil fee)
- Account-level deposit needed and approval requirements
- A `ready` flag — false if a deposit or FWSS approval is required

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
│           buildMigrationInventories()                      │
│  + IndexingServiceReader (queryClaims)                     │
│  + SourceURLResolver (ClaimsResolver | RoundaboutResolver) │
│                                                            │
│  → state.spacesInventories  (uploads, shards, final URLs)  │
└────────────────────┬───────────────────────────────────────┘
                     │ Object.values(state.spacesInventories)
                     ▼
┌────────────────────────────────────────────────────────────┐
│                createMigrationPlan()                       │
│  + Synapse SDK (createContext per space, chain reads)      │
│                                                            │
│  → plan:ready  (costs, totals, ready flag)                 │
└────────────────────┬───────────────────────────────────────┘
                     │ plan + state (SP bindings written)
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

```js
import {
  createInitialState,
  buildMigrationInventories,
  createMigrationPlan,
  executeMigration,
  serializeState,
  ClaimsResolver,
} from '@storacha/filecoin-pin-migration'

const state = createInitialState()
const resolver = new ClaimsResolver() // or new RoundaboutResolver()

// 1. Read — build inventories for all spaces
for await (const event of buildMigrationInventories({ client, resolver, state })) {
  if (event.type === 'state:checkpoint') {
    await fs.writeFile('migration-state.json', JSON.stringify(serializeState(event.state)))
  }
}

// 2. Plan — compute costs and get user approval
let plan
for await (const event of createMigrationPlan({ synapse, config, state })) {
  if (event.type === 'state:checkpoint') {
    await fs.writeFile('migration-state.json', JSON.stringify(serializeState(event.state)))
  }
  if (event.type === 'plan:ready') plan = event.plan
}

console.log(`Shards:  ${plan.totals.shards}`)
console.log(`Bytes:   ${plan.totals.bytes}`)
console.log(`Deposit: ${plan.costs.totalDepositNeeded} USDFC`)

if (!plan.ready) {
  console.error('Not ready:', plan.warnings)
  process.exit(1)
}

// Present plan to user and wait for approval...

// 3. Execute
for await (const event of executeMigration({ plan, state, synapse, config })) {
  switch (event.type) {
    case 'funding:start':
      console.log(`Depositing ${event.amount} USDFC...`)
      break
    case 'funding:complete':
      console.log('Funded.')
      break
    case 'state:checkpoint':
      // Persist state after every checkpoint — enables resume on crash
      await fs.writeFile('migration-state.json', JSON.stringify(serializeState(event.state)))
      break
    case 'shard:failed':
      console.error(`Shard failed: ${event.shard}`, event.error)
      break
    case 'migration:complete':
      console.log(`Done. ${event.summary.succeeded} committed, ${event.summary.failed} failed.`)
      break
  }
}
```

---

## Source URL strategies

The `SourceURLResolver` controls the URL given to the storage provider for pulling each shard. It is applied at read time — `SpaceInventory` shards already carry final URLs by the time the planner sees them.

| Resolver | URL format | When to use |
|---|---|---|
| `ClaimsResolver` | Raw R2 URL from indexing service claims | Curio supports arbitrary URLs |
| `RoundaboutResolver` | `https://roundabout.web3.storage/piece/<pieceCID>` | Default — works with current SP configuration |

```js
import { ClaimsResolver, RoundaboutResolver, createResolver } from '@storacha/filecoin-pin-migration'

// Explicit
const resolver = new RoundaboutResolver()
const resolver = new RoundaboutResolver('https://my-roundabout.example')

// From MigrationConfig
const resolver = createResolver(config) // reads config.sourceURL.strategy
```

---

## Configuration

```ts
interface MigrationConfig {
  storacha: {
    client: Client           // Authenticated @storacha/client instance
    spaces?: SpaceDID[]      // Filter to specific spaces; default: all
  }
  foc: {
    synapse: Synapse          // Initialized @filoz/synapse-sdk instance
    providerIds?: bigint[]    // Target specific SPs; default: SDK auto-selects
  }
  sourceURL: {
    strategy: 'roundabout' | 'claims'
    roundaboutURL?: string   // Override default roundabout endpoint
  }
  options?: {
    batchSize?: number        // Pieces per pull batch (default: 50)
    stopOnError?: boolean     // Stop remaining batches for an upload on failure (default: false)
    signal?: AbortSignal      // Cancellation
  }
}
```

---

## Events

All three stages yield events. Consumers should handle `state:checkpoint` at every stage to enable crash recovery.

| Event | Stage | When | Key fields |
|---|---|---|---|
| `reader:space:start` | reader | Before first page of a space | `spaceDID` |
| `reader:space:complete` | reader | After last page of a space | `spaceDID` |
| `state:checkpoint` | reader | After every `upload.list` page | `state` |
| `reader:complete` | reader | After all spaces read | — |
| `state:checkpoint` | planner | After SP bindings written to state | `state` |
| `plan:ready` | planner | Carries plan for display/approval | `plan` |
| `funding:start` | migrator | Before `fundSync` transaction | `amount: bigint` |
| `funding:complete` | migrator | After `fundSync` lands | — |
| `funding:failed` | migrator | If `fundSync` throws — generator terminates | `error` |
| `shard:failed` | migrator | Per shard that fails presign, pull, or commit | `spaceDID`, `root`, `shard`, `error` |
| `state:checkpoint` | migrator | After each batch with ≥1 commit; after each space finalizes | `state` |
| `migration:complete` | migrator | Once, after all spaces | `summary` |

`funding:failed` is the only event that terminates the generator early. All per-shard failures surface as `shard:failed` — execution continues.

---

## Error handling

Each stage of a batch has distinct failure semantics:

| Stage | Failure class | Scope |
|---|---|---|
| Presign | `PresignFailedFailure` | Whole batch — no EIP-712 signature, cannot proceed |
| Pull | `PullFailedFailure` | Per piece — commit proceeds with pieces that pulled successfully |
| Commit | `CommitFailedFailure` | All successfully pulled pieces in the batch |

All failures are yielded as `shard:failed` events. `executeMigration` never throws for per-shard failures — only `funding:failed` terminates the generator early.

---

## State lifecycle

```
Migration:  reading → planning → approved → funded → migrating → complete | incomplete
Space:      pending → complete | incomplete | failed
Upload:     pending → migrating → complete | incomplete   (computed, not stored)
```

- `complete` — every shard committed
- `incomplete` — some shards committed, some not
- `failed` — space processed with zero commits

State is serialized/deserialized as JSON. `bigint` fields (`providerId`, `dataSetId`, `sizeBytes`) are encoded as decimal strings.

```js
import { serializeState, deserializeState } from '@storacha/filecoin-pin-migration'

// Save
const json = JSON.stringify(serializeState(state))

// Load
const state = deserializeState(JSON.parse(json))
```

---

## License

Apache-2.0 OR MIT
