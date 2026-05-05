## Purpose

This file defines how AI agents (Claude) should operate in this repository.

It enforces architectural boundaries, coding conventions, and safe modification patterns.

---

## First Rule

Before making any non-trivial change:

1. Read `@.context/ARCHITECTURE.md`
2. Identify which stage the change belongs to (reader / planner / migrator)
3. Follow all **Core Invariants**

If unsure → ask or reason explicitly before coding.

---

## System Mental Model

The system is a strict pipeline:

reader → planner → migrator

- reader = builds snapshot (SpaceInventory)
- planner = pure function (MigrationPlan)
- migrator = stateful executor (events + state)

Never break this separation.

### Module map

| File | Responsibility |
|---|---|
| `src/api.ts` | **All types.** Single source of truth. Read this first. |
| `src/reader/reader.js` | Inventory building — paginates uploads, resolves shards via indexing service claims |
| `src/reader/source-url.js` | `ClaimsResolver` / `RoundaboutResolver` — applied at reader level |
| `src/planner/planner.js` | Aggregates inventories, delegates cost computation, returns `MigrationPlan` |
| `src/planner/compute-migration-costs.js` | Heavy Synapse SDK interaction — creates 2 `StorageContext`s per space, reads chain in one batch |
| `src/migrator/migrator.js` | Public mixed migration entrypoint — resolves defaults, validates capabilities, then delegates execution to the shared runner |
| `src/migrator/execution-config.js` | Shared entrypoint config normalization — defaults and conditional fetcher validation |
| `src/migrator/concurrent.js` | Shared bounded-concurrency runner — preserves completed results on abort |
| `src/migrator/pull-results.js` | Shared pull-result reconciliation — failed roots, pull checkpoints, batch failure events |
| `src/migrator/retry-policy.js` | Shared store retry classification — typed retryable errors and fetch/store retry decisions |
| `src/migrator/run-migration.js` | Shared outer migration runner — funding, phase transition, per-space loop, finalization, summary |
| `src/migrator/space-runner.js` | Deep per-space migrator — source-pull for `shards`, store-on-copy0 for `shardsToStore`, then sequential internal commit batches per copy |
| `src/migrator/store-flow.js` | Store-specific execution helpers — `store()` on copy 0 and pull-from-copy0 on copy 1 |
| `src/migrator/store-executor.js` | Standalone store-only executor — prepares an all-store inventory view and delegates to the shared migrator |
| `src/migrator/commit.js` | Shared commit batching/execution — internal `count` / `extraData` / `none` batch modes |
| `src/migrator/pull.js` | Shared presign+pull batch helper |
| `src/migrator/summary.js` | Shared migration summary derivation across executors |
| `src/state.js` | Pure state mutations and phase FSM — checkpoint functions and serialization |
| `src/errors.js` | Typed `Failure` subclasses — one per failure mode |
| `src/index.js` | Barrel exports |
| `test/helpers.js` | Shared mock factories for all test files |

---

## Where to Make Changes

- Data fetching / indexing logic → `reader/reader.js`
- URL resolution → `reader/source-url.js`
- Cost logic → `planner/compute-migration-costs.js`
- Plan construction → `planner/planner.js`
- Execution logic → `migrator/migrator.js` / `migrator/space-runner.js` / `migrator/store-flow.js`
- State transitions → `state.js`
- Types → `api.ts` (only place for types)

---

## Allowed vs Forbidden Changes

### ✅ Allowed

- Add new fields to types (in `api.ts`)
- Extend reader logic (new data sources, filters)
- Improve planner calculations (pure only)
- Add new MigrationEvents
- Improve migrator batching / concurrency (within stage)

---

### ❌ Forbidden

- Adding cross-stage logic (e.g. planner calling migrator logic)
- Resolving URLs outside reader
- Copying state instead of mutating it
- Adding I/O (disk, console, network unrelated to core flow)

---

## State Rules (CRITICAL)

- `MigrationState` is mutated in place
- Never clone or spread state before updating
- Always use provided state functions:
  - `recordPull`
  - `recordFailedUpload`
  - `recordCommit`
  - `finalizeSpace`
  - `finalizeMigration`
  - `transitionToFunded`

Incorrect state handling will break resume.

- Each space must keep exactly 2 copy records in `space.copies`
- The 2 copies must stay bound to distinct providers

---

## Data Handling Rules

- Treat `SpaceInventory` as immutable after reader
- Treat `MigrationPlan` as immutable
- Only `MigrationState` is mutable

---

## Error Handling Rules

- Do NOT throw inside batch processing
- All non-funding failures must become migration events
- Only funding failure can terminate execution

---

## When Adding Features

Follow this order:

1. Update types in `api.ts`
2. Implement logic in the correct stage
3. Ensure invariants are preserved
4. Update `ARCHITECTURE.md` if behavior changes
5. Add/update roadmap task (if applicable)
6. Add tests

---

## Testing Strategy

- reader: mock Storacha + indexer
- planner: mock Synapse SDK (pure logic)
- migrator: mock StorageContext (presign/pull/commit)

Planner must always be testable without network.

---

## Common Pitfalls

Avoid these mistakes:

- ❌ Re-resolving URLs in migrator
- ❌ Mutating inventories in planner
- ❌ Introducing hidden state outside MigrationState
- ❌ Re-fetching data during migration
- ❌ Breaking idempotency (not checking per-copy `pulled` / `committed` sets)

---

## How to Approach Tasks

When implementing something:

1. Identify the stage
2. Identify inputs and outputs
3. Check invariants
4. Implement minimal change
5. Validate against resume + idempotency

---

## When You Are Unsure

You MUST:

- State assumptions explicitly
- Reference ARCHITECTURE.md
- Prefer safe, minimal changes
- Avoid introducing new patterns

---

## Style Guidelines

- Prefer clarity over cleverness
- Keep functions small and composable
- Avoid implicit behavior
- Use explicit naming aligned with architecture

---

## Goal

Your goal is to:

- Preserve architectural integrity
- Maintain deterministic behavior
- Ensure resumability and correctness
- Enable safe evolution of the system

Not just “make it work”.
