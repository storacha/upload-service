import { ensureFunding } from './funding.js'
import { summarizeSpaceMigration } from './summary.js'
import { finalizeMigration } from '../state.js'

/**
 * @import * as API from '../api.js'
 */

/**
 * Shared top-level execution runner used by both public migrator entrypoints.
 *
 * Owns the lifecycle around per-space execution:
 *   1. fund once
 *   2. transition to `migrating`
 *   3. iterate planned spaces
 *   4. finalize the migration
 *   5. emit `migration:complete`
 *
 * Entrypoints customize only:
 *   - how a source inventory is adapted for execution
 *   - which shard bucket is counted in the summary
 *   - how one prepared space is executed
 *
 * @param {object} args
 * @param {API.MigrationPlan} args.plan
 * @param {API.MigrationState} args.state
 * @param {API.Synapse} args.synapse
 * @param {AbortSignal | undefined} args.signal
 * @param {bigint} args.totalBytes
 * @param {(inventory: API.SpaceInventory) => Iterable<{ cid: string }>} args.getActionableShards
 * @param {(args: {
 *   sourceInventory: API.SpaceInventory
 *   perSpaceCost: API.PerSpaceCost
 * }) => API.SpaceInventory | undefined} args.prepareInventory
 * @param {(args: {
 *   inventory: API.SpaceInventory
 *   perSpaceCost: API.PerSpaceCost
 * }) => AsyncGenerator<API.MigrationEvent>} args.executeSpace
 * @returns {AsyncGenerator<API.MigrationEvent>}
 */
export async function* runMigration({
  plan,
  state,
  synapse,
  signal,
  totalBytes,
  getActionableShards,
  prepareInventory,
  executeSpace,
}) {
  yield* ensureFunding(plan.costs, plan.fundingAmount, synapse, state)

  state.phase = 'migrating'
  let succeeded = 0
  let failed = 0
  let skippedUploads = 0
  /** @type {bigint[]} */
  const dataSetIds = []

  for (const perSpaceCost of plan.costs.perSpace) {
    if (signal?.aborted) return

    const sourceInventory = state.spacesInventories[perSpaceCost.spaceDID]
    if (!sourceInventory) continue

    const inventory = prepareInventory({ sourceInventory, perSpaceCost })
    if (!inventory) continue

    yield* executeSpace({ inventory, perSpaceCost })

    const spaceSummary = summarizeSpaceMigration({
      state,
      spaceDID: perSpaceCost.spaceDID,
      inventory,
      getActionableShards,
    })
    succeeded += spaceSummary.succeeded
    failed += spaceSummary.failed
    skippedUploads += spaceSummary.skippedUploads
    dataSetIds.push(...spaceSummary.dataSetIds)
  }

  if (signal?.aborted) return

  finalizeMigration(state)

  yield {
    type: 'migration:complete',
    summary: {
      succeeded,
      failed,
      skippedUploads,
      dataSetIds,
      totalBytes,
    },
  }
}
