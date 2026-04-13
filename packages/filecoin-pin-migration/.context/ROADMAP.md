# Roadmap — `@storacha/filecoin-pin-migration`

**Core value:** Users can migrate all their Storacha data to FOC with no downloads, no re-uploads, no data loss — before Storacha services shut down.

**Last updated:** 2026-04-09

---

## v1 — Library

### Package & Types

- [x] **PKG-01** — Package scaffold (`package.json`, `tsconfig`, exports map, pnpm catalog entries for `@filoz/synapse-sdk` and `viem`)
- [x] **PKG-02** — Core type definitions in `src/api.ts` (`MigrationConfig`, `MigrationPlan`, `MigrationEvent`, `MigrationState`, `MigrationSummary`, `SpaceInventory`, `ResolvedShard`)
- [x] **PKG-03** — Typed failure classes in `src/errors.js`: `MissingPieceCIDFailure`, `MissingLocationURLFailure`, `InsufficientFundsFailure`, `PresignFailedFailure`, `PullFailedFailure`, `CommitFailedFailure`

### Reader

- [x] **READ-01** — Iterate all spaces via `client.spaces()` or an explicit `SpaceDID[]` filter; paginate all uploads in each space via `upload.list()`
- [x] **READ-02** — Extract `pieceCID` from `assert/equals` claims; filter out index-blob location claims by comparing `claim.content` multihash against the shard's known multihash
- [x] **READ-03** — Extract source URLs from `assert/location` claims for each shard
- [x] **READ-04** — Pre-compute `totalUploads`, `totalShards`, and `totalBytes` on `SpaceInventory` at read time — no second pass needed downstream
- [ ] **READ-05** - Spaces are currently processed sequentially; add concurrency to improve performance.

### Source URL

- [x] **SRC-01** — `RoundaboutResolver` builds `https://roundabout.web3.storage/piece/{pieceCidV2}` without network calls
- [x] **SRC-02** — `ClaimsResolver` returns the location URL already resolved from indexing service claims
- [x] **SRC-03** — Source URL strategy is config-driven (`{ strategy: 'roundabout' | 'claims' }`); `createResolver(config)` instantiates the correct resolver. The resolver is applied at read time inside `buildMigrationInventories` — `SpaceInventory` shards carry final `sourceURL` values before the planner sees them

### Planner

- [x] **PLAN-01** — `buildMigrationInventories` builds a full `SpaceInventory` per space into `state.spacesInventories`; `createMigrationPlan` is an async generator that reads inventories from `state.spacesInventories`, aggregates totals, computes costs, writes SP bindings to state, and yields a `plan:ready` event carrying the `MigrationPlan`
- [x] **PLAN-02** — `computeMigrationCosts` replicates the Synapse SDK `calculateMultiContextCosts` logic with heterogeneous per-space sizes — one `StorageContext` per space
- [x] **PLAN-03** — `MigrationPlan` carries `costs.totalDepositNeeded`, `costs.needsFwssMaxApproval`, and `costs.ready` flag derived from USDFC balance, deposited balance, and FWSS approval state
- [x] **PLAN-04** — `createMigrationPlan` requires a `MigrationState` for both fresh and resume runs; SP and dataset bindings are extracted automatically via `buildResumeState` and passed to `computeMigrationCosts` to pin the same provider and compute floor-aware rate deltas

### Migrator

- [x] **MIG-01** — `executeMigration` orchestrates multi copies pull-based migration via Synapse SDK — 1 Storacha space → 1 FOC dataset per SP — processing uploads sequentially with configurable batch size
- [x] **MIG-02** — Fund once pre-flight via `synapse.payments.fundSync`; skip funding on resume when deposit is already satisfied
- [x] **MIG-03** — Commit pieces on-chain via `StorageContext.commit()` with `withIPFSIndexing: ''` dataset metadata and `ipfsRootCID: rootCID` per-piece metadata
- [x] **MIG-04** — All three stages yield typed `MigrationEvent`. Reader: `reader:space:start`, `reader:space:complete`, `reader:complete`, `state:checkpoint`. Planner: `state:checkpoint`, `plan:ready`. Migrator: `funding:start`, `funding:complete`, `funding:failed`, `shard:failed`, `state:checkpoint`, `migration:complete`
- [x] **MIG-05** — Resume: `MigrationState` tracks committed shards per provider in `state.committed`; shards already committed to the target provider are skipped at the start of each batch
- [x] **MIG-06** — Respects `batchSize` option from `MigrationConfig` (default: 50 pieces per batch)
- [ ] **MIG-07** — `concurrency` option in `MigrationConfig` (default: 1) — process multiple batches concurrently within an upload to reduce wall-clock time for large spaces

### State management

- [x] **STATE-01** — `createInitialState` creates a fresh `MigrationState` before the reader runs; SP bindings are written into state by the planner via `transitionToApproved` after cost computation
- [x] **STATE-02** — `transitionToFunded` advances migration phase after `fundSync` lands
- [x] **STATE-03** — `recordCommit` updates the committed map, increments upload progress, and resolves the active upload phase; guards against double-counting on multi-provider commits
- [x] **STATE-04** — `finalizeSpace` / `finalizeMigration` resolve terminal phases for uploads, spaces, and the top-level migration after each space loop completes
- [x] **STATE-05** — `serializeState` / `deserializeState` provide a JSON-safe round-trip; `bigint` fields encoded as decimal strings
- [x] **STATE-06** — Phase FSM enforced by pure resolvers: upload (`pending → migrating → complete | incomplete`, computed not stored), space (`pending → complete | incomplete | failed`), migration (`reading → planning → approved → funded → migrating → complete | incomplete`)

### Tests

- [x] **TEST-01** — Unit tests for `reader.js`: index-blob claim filter, `pieceCID` extraction, missing `pieceCID` and missing location URL skip cases, multi-page pagination, `ClaimsResolver` and `RoundaboutResolver` application
- [x] **TEST-02** — Unit tests for `planner.js`: totals aggregation, cost and warning propagation, skipped shards surfaced as plan warnings, `state:checkpoint` before `plan:ready` event order, SP bindings written to state (`computeMigrationCosts` is mocked — planner logic only)
- [ ] **TEST-03** — Unit tests for `migrator.js`: mock Synapse SDK, presign/pull/commit flow, per-piece pull failure partitioning, `stopOnError` semantics, resume skip path, full event sequence
- [x] **TEST-04** — Unit tests for `source-url.js`: `ClaimsResolver` pass-through, `RoundaboutResolver` URL construction, custom base URL override
- [ ] **TEST-05** — Unit tests for `state.js`: phase FSM transitions, `recordCommit` double-commit guard, `serializeState` / `deserializeState` round-trip, `parseBigIntField` validation errors
- [ ] **TEST-06** — Unit tests for `compute-migration-costs.js`: mock Synapse SDK chain calls, per-space lockup math, resume path with existing dataset IDs, skip-buffer logic, conflict warning when configured provider differs from pinned provider

---

## v1 — CLI integration

> Tracked here for visibility. Implementation lives in `@storacha/cli`.

- [ ] **CLI-01** — `storacha migration migrate-to-foc` command wired into the CLI
- [ ] **CLI-02** — CLI calls `createMigrationPlan()`, renders the plan (spaces, shards, cost, funding status, warnings), and gates execution on user confirmation
- [ ] **CLI-03** — CLI renders `MigrationEvent` stream as real-time progress output during execution
- [ ] **CLI-04** — Flags: `--space <DID>`, `--dry-run`, `--network calibration|mainnet`, `--source-url roundabout|claims`

---

## v1 — Resilience

- [ ] **RES-01** — Integration test against Calibration net with a real Storacha space — validates the full read → plan → execute flow end-to-end against live infrastructure

---

## v2 — Console integration

> Implementation lives in `@storacha/console`.

- [ ] **CON-01** — `/migrate` page that iterates over all spaces the user has access to, with the option to select a subset before proceeding
- [ ] **CON-02** — Connect wallet via wagmi/viem browser wallet (MetaMask)
- [ ] **CON-03** — Render `MigrationPlan` as a review UI — spaces, shards, byte totals, cost breakdown, warnings — before execution
- [ ] **CON-04** — Render `MigrationEvent` stream as a live progress table during execution
