# Storacha to FOC Migration Library

## What This Is

A headless migration library (`@storacha/filecoin-pin-migration`) and CLI command that enables Storacha users to migrate their stored content to Filecoin on Chain (FOC) without re-uploading data.

The library is designed to be:

- consumed by CLI (v1)
- consumed by Console UI (future)
- reusable by external integrations

---

## Core Value

Users can migrate all their Storacha data to FOC with:

- no downloads  
- no re-uploads  
- no data loss  

before Storacha services shut down.

---

## User Journey

1. User runs CLI command or uses UI
2. Library reads all Storacha spaces and builds inventories
3. Library computes a migration plan (including cost estimation)
4. User reviews and confirms the plan
5. Migration executes with progress events
6. Migration can be resumed safely if interrupted

---

## Success Criteria

A migration is considered successful when:

- All shards are committed to the target Service Provider(s)
- No required data (pieceCIDs) is missing
- `MigrationState.phase === complete`
- All spaces are finalized (`complete` or `incomplete` with warnings)

---

## Requirements

### Active

- [ ] Resolve uploads, shards, pieceCIDs, and location claims for all spaces
- [ ] Support paginated listing across multiple spaces
- [ ] Support configurable source URL strategies
- [ ] Compute migration plan with cost estimation and funding validation
- [ ] Detect missing pieceCIDs and report warnings
- [ ] Execute pull-based migration via Synapse SDK
- [ ] Map 1 Storacha space → 1 FOC dataset per SP
- [ ] Emit typed progress events for UX consumers
- [ ] Support resume/idempotency
- [ ] Batch shards with configurable size
- [ ] Support multi-SP orchestration
- [ ] Provide CLI command for migration execution
- [ ] Support filtering and network selection
- [ ] Follow `Result<T, Failure>` error pattern

### Validated

(None yet — ship to validate)

### Out of Scope

- Console UI implementation
- Fiat payment flows
- Automatic USDFC acquisition
- Migration guides for external SDK users

---

## Context

Storacha hot storage services are shutting down.

- ~20,000 users
- ~150–200 TB of data
- Data stored as sharded CAR files (≤128MB per shard)

A migration path is required that avoids:

- massive downloads
- re-uploads
- high egress costs

---

## Constraints (High-Level)

- Migration must be pull-based (no user re-upload)
- Users must provide funded wallets (USDFC + gas)
- Source URLs may expire (needs validation)
- IPNI indexing is best-effort
- System must support resumability and idempotency

---

## Evolution Rules

This document evolves at product-level milestones:

### After each phase

- Move validated requirements → **Validated**
- Move dropped requirements → **Out of Scope**
- Add new requirements → **Active**

### After each milestone

- Re-evaluate Core Value
- Re-check Success Criteria
- Update Context if assumptions changed

---

*Last updated: 2026-04-09*
