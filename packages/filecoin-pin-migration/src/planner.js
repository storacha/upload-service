import { computeMigrationCosts } from './compute-migration-costs.js'
import { buildResumeState, transitionToApproved } from './state.js'

/**
 * @import { Synapse, MigrationConfig, MigrationState, MigrationEvent } from './api.js'
 */

/**
 * Build a migration plan from space inventories held in state.
 *
 * Inventories are read from `state.spacesInventories` — populated by
 * `buildMigrationInventories` before the planner runs. The planner aggregates
 * totals, computes costs via the Synapse SDK, writes SP bindings to state, and
 * yields:
 *   state:checkpoint — SP bindings written; state.phase → 'approved'
 *   plan:ready       — carries the MigrationPlan for consumer display/approval
 *
 * The consumer shows the plan to the user. If approved, pass state and plan to
 * executeMigration(). SP bindings in state ensure the same provider is used on
 * resume even if the process crashes before executeMigration begins.
 *
 * ## Resume
 *
 * Pass the deserialized `MigrationState`. The planner extracts pinned SP and
 * dataset bindings via `buildResumeState` so:
 *  - Every space binds to the same storage provider as the original run.
 *  - Floor-aware rate deltas are computed against the existing on-chain dataset.
 *
 * Typical resume sequence:
 * ```js
 * const state = deserializeState(JSON.parse(raw))
 * for await (const event of createMigrationPlan({ synapse, config, state })) {
 *   if (event.type === 'plan:ready') plan = event.plan
 *   if (event.type === 'state:checkpoint') await saveState(event.state)
 * }
 * for await (const event of executeMigration({ plan, state, synapse, config })) { ... }
 * ```
 *
 * @param {object} args
 * @param {Synapse} args.synapse
 * @param {MigrationConfig} args.config
 * @param {MigrationState} args.state
 * @returns {AsyncGenerator<MigrationEvent>}
 */
export async function* createMigrationPlan({ synapse, config, state }) {
  const inventories = Object.values(state.spacesInventories)
  const totalUploads = inventories.reduce((n, inv) => n + inv.totalUploads, 0)
  const totalShards = inventories.reduce((n, inv) => n + inv.totalShards, 0)
  const totalBytes = inventories.reduce((n, inv) => n + inv.totalBytes, 0n)

  // ── Cost aggregation (creates contexts + reads chain in one batch) ────────
  const costs = await computeMigrationCosts(inventories, synapse, {
    resumeState: buildResumeState(state),
    configuredProviderIds: config.foc.providerIds,
  })

  // ── Plan-level warnings ───────────────────────────────────────────────────
  const warnings = [...costs.warnings]
  for (const inv of inventories) {
    if (inv.skippedShards.length > 0) {
      warnings.push(`${inv.did}: ${inv.skippedShards.length} shard(s) skipped`)
    }
  }

  const plan = {
    totals: { uploads: totalUploads, shards: totalShards, bytes: totalBytes },
    costs,
    warnings,
    ready: costs.ready,
  }

  // ── Write SP bindings to state and checkpoint ─────────────────────────────
  transitionToApproved(state, costs.perSpace)
  yield /** @type {MigrationEvent} */ ({ type: 'state:checkpoint', state })
  yield /** @type {MigrationEvent} */ ({ type: 'plan:ready', plan })
}
