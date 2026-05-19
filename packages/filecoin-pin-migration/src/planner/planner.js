import { computeMigrationCosts } from './compute-migration-costs.js'
import { buildResumeState, getInventorySummaryMap } from '../state.js'

/**
 * @import { CreatePlanInput, MigrationEvent, MigrationPlan } from '../api.js'
 */

/** 5% safety buffer over the deposit to cover gas estimation variance. */
const SAFETY_BUFFER_BPS = 500n
const BPS_BASE = 10000n

/**
 * Build a migration plan from the store-owned reader output.
 *
 * The planner aggregates inventory totals from the in-memory summaries,
 * computes costs via the Synapse SDK, writes SP bindings to state, and yields:
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
export async function* createMigrationPlan({ synapse, store, providerIds }) {
  const state = store.getState()
  const summaries = Object.values(getInventorySummaryMap(state))
  const costSpaces = summaries.map((inv) => ({
    did: inv.did,
    ...(inv.name !== undefined ? { name: inv.name } : {}),
    totalSizeToMigrate: inv.totalSizeToMigrate,
  }))

  let totalUploads = 0
  let totalShards = 0
  let totalBytes = 0n
  let bytesToMigrate = 0n
  /** @type {string[]} */
  const warnings = []

  for (const inv of summaries) {
    totalUploads +=
      'uploadsCount' in inv ? inv.uploadsCount : inv.uploads.length
    totalShards +=
      'shardsCount' in inv && 'shardsToStoreCount' in inv
        ? inv.shardsCount + inv.shardsToStoreCount
        : inv.shards.length + inv.shardsToStore.length
    totalBytes += inv.totalBytes
    bytesToMigrate += inv.totalSizeToMigrate

    const skippedUploadsCount =
      'skippedUploadsCount' in inv
        ? inv.skippedUploadsCount
        : inv.skippedUploads.length
    if (skippedUploadsCount > 0) {
      warnings.push(
        `${inv.did}: ${skippedUploadsCount} upload(s) have unresolvable shards and will be skipped`
      )
    }
  }

  // ── Cost aggregation (creates contexts + reads chain in one batch) ────────
  const costs = await computeMigrationCosts(costSpaces, synapse, {
    resumeState: buildResumeState(state),
    configuredProviderIds: providerIds,
  })
  warnings.push(...costs.warnings)

  // ── Funding amount with safety buffer ────────────────────────────────────
  // TODO: allow user to specify custom buffer
  const fundingAmount =
    costs.totalDepositNeeded > 0n
      ? costs.totalDepositNeeded +
        (costs.totalDepositNeeded * SAFETY_BUFFER_BPS) / BPS_BASE
      : 0n

  /** @type {MigrationPlan} */
  const plan = {
    totals: {
      uploads: totalUploads,
      shards: totalShards,
      bytes: totalBytes,
      bytesToMigrate,
    },
    costs,
    warnings,
    ready: costs.ready,
    fundingAmount,
  }

  // ── Write SP bindings to state and checkpoint ─────────────────────────────
  store.transitionToApproved(costs.perSpace)
  yield /** @type {MigrationEvent} */ ({ type: 'state:checkpoint', state })
  yield /** @type {MigrationEvent} */ ({ type: 'planner:ready', plan })
}
