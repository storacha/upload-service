import { computeMigrationCosts } from './compute-migration-costs.js'
import { buildResumeState, transitionToApproved } from './state.js'

/**
 * @import { CreatePlanInput, MigrationEvent, MigrationPlan } from './api.js'
 */

/** 5% safety buffer over the deposit to cover gas estimation variance. */
const SAFETY_BUFFER_BPS = 500n
const BPS_BASE = 10000n

/**
 * Build a migration plan from space inventories held in state.
 *
 * Inventories are read from `state.spacesInventories` — populated by
 * `buildMigrationInventories` before the planner runs. The planner aggregates
 * totals, computes costs via the Synapse SDK, writes SP bindings to state, and
 * yields:
 *   state:checkpoint — SP bindings written; state.phase → 'approved'
 *   planner:ready       — carries the MigrationPlan for consumer display/approval
 *
 * The consumer shows the plan to the user. If approved, pass state and plan to
 * executeMigration(). SP bindings in state ensure the same providers are used
 * on resume even if the process crashes before executeMigration begins.
 *
 * ## Resume
 *
 * Pass the deserialized `MigrationState`. The planner extracts pinned SP and
 * dataset bindings via `buildResumeState` so:
 *  - Every space copy binds to the same storage provider as the original run.
 *  - Floor-aware rate deltas are computed against the existing on-chain
 *    datasets for each copy.
 *
 * Typical resume sequence:
 * ```js
 * const state = deserializeState(JSON.parse(raw))
 * for await (const event of createMigrationPlan({ synapse, state })) {
 *   if (event.type === 'planner:ready') plan = event.plan
 *   if (event.type === 'state:checkpoint') await saveState(event.state)
 * }
 * for await (const event of executeMigration({ plan, state, synapse })) { ... }
 * ```
 *
 * @param {CreatePlanInput} input
 * @returns {AsyncGenerator<MigrationEvent>}
 */
export async function* createMigrationPlan({ synapse, state, providerIds }) {
  const inventories = Object.values(state.spacesInventories)

  let totalUploads = 0
  let totalShards = 0
  let totalBytes = 0n
  /** @type {string[]} */
  const warnings = []

  for (const inv of inventories) {
    totalUploads += inv.uploads.length
    totalShards += inv.shards.length
    totalBytes += inv.totalBytes

    if (inv.failedUploads.length > 0) {
      warnings.push(
        `${inv.did}: ${inv.failedUploads.length} upload(s) have unresolvable shards and will not be migrated`
      )
    }
  }

  // ── Cost aggregation (creates contexts + reads chain in one batch) ────────
  const costs = await computeMigrationCosts(inventories, synapse, {
    resumeState: buildResumeState(state),
    configuredProviderIds: providerIds,
  })
  warnings.push(...costs.warnings)

  // ── Funding amount with safety buffer ────────────────────────────────────
  const fundingAmount =
    costs.totalDepositNeeded > 0n
      ? costs.totalDepositNeeded +
        (costs.totalDepositNeeded * SAFETY_BUFFER_BPS) / BPS_BASE
      : 0n

  if (fundingAmount > 0n) {
      warnings.push(
      `Funding amount includes a ${Number((SAFETY_BUFFER_BPS * 100n) / BPS_BASE)}% safety buffer over the deposit: ${fundingAmount} total (deposit: ${costs.totalDepositNeeded})`
      )
  }

  /** @type {MigrationPlan} */
  const plan = {
    totals: { uploads: totalUploads, shards: totalShards, bytes: totalBytes },
    costs,
    warnings,
    ready: costs.ready,
    fundingAmount,
  }

  // ── Write SP bindings to state and checkpoint ─────────────────────────────
  transitionToApproved(state, costs.perSpace)
  yield /** @type {MigrationEvent} */ ({ type: 'state:checkpoint', state })
  yield /** @type {MigrationEvent} */ ({ type: 'planner:ready', plan })
}
