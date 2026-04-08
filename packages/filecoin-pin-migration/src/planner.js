import { computeMigrationCosts } from './compute-migration-costs.js'
import { buildResumeState } from './state.js'

/**
 * @import * as API from './api.js'
 */

/**
 * Build a migration plan from space inventories.
 *
 * Inventories are expected to carry final sourceURLs — the resolver is applied
 * at read time by `buildMigrationInventory`. The planner's job is to aggregate
 * totals, compute costs via the Synapse SDK, and return a `MigrationPlan` ready
 * for user approval.
 *
 * ## Resume
 *
 * Pass the deserialized `MigrationState` as the fourth argument. The planner
 * internally extracts the pinned SP and dataset bindings via `buildResumeState`
 * and passes them to the cost calculator. This ensures:
 *  - Every space binds to the same storage provider as the original run.
 *  - Floor-aware rate deltas are computed against the existing on-chain dataset.
 *
 * Typical resume sequence:
 * ```js
 * const state = deserializeState(JSON.parse(raw))
 * const plan  = await createMigrationPlan(inventories, synapse, config, state)
 * for await (const event of executeMigration({ plan, state, synapse, config })) { ... }
 * ```
 *
 * @param {API.SpaceInventory[]} inventories
 * @param {API.Synapse} synapse
 * @param {API.MigrationConfig} config
 * @param {API.MigrationState} [state] - Pass persisted state to resume a prior run
 * @returns {Promise<API.MigrationPlan>}
 */
export async function createMigrationPlan(inventories, synapse, config, state) {
  // ── Build PlanSpaces (shallow copy — don't mutate inventories) ────────────
  /** @type {API.PlanSpace[]} */
  const spaces = inventories.map((inv) => ({
    ...inv,
    skippedShards: [...inv.skippedShards],
  }))

  const totalUploads = inventories.reduce((n, inv) => n + inv.totalUploads, 0)
  const totalShards = inventories.reduce((n, inv) => n + inv.totalShards, 0)
  const totalBytes = inventories.reduce((n, inv) => n + inv.totalBytes, 0n)

  // ── Cost aggregation (creates contexts + reads chain in one batch) ────────
  const costs = await computeMigrationCosts(spaces, synapse, {
    resumeState: state ? buildResumeState(state) : undefined,
    configuredProviderIds: config.foc.providerIds,
  })

  // ── Plan-level warnings ───────────────────────────────────────────────────
  const warnings = [...costs.warnings]
  for (const space of spaces) {
    if (space.skippedShards.length > 0) {
      warnings.push(
        `${space.did}: ${space.skippedShards.length} shard(s) skipped`
      )
    }
  }

  return {
    spaces,
    totals: { uploads: totalUploads, shards: totalShards, bytes: totalBytes },
    costs,
    warnings,
    ready: costs.ready,
  }
}
