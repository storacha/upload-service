import { ensureFunding } from './funding.js'
import { summarizeSpaceMigration } from './summary.js'
import { materializeSpaceInventory } from '../store/materialize-space-inventory.js'

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
 *   5. emit a final state checkpoint with the terminal top-level phase
 *   6. emit `migration:complete`
 *
 * Entrypoints customize only:
 *   - how a source inventory is adapted for execution
 *   - which shard bucket is counted in the summary
 *   - how one prepared space is executed
 *
 * @param {object} args
 * @param {API.MigrationPlan} args.plan
 * @param {API.MigrationStore} args.store
 * @param {API.Synapse} args.synapse
 * @param {AbortSignal | undefined} args.signal
 * @param {bigint} args.totalBytes
 * @param {(inventory: API.SpaceInventory) => Iterable<{ cid: string, root: string }>} args.getActionableShards
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
  store,
  synapse,
  signal,
  totalBytes,
  getActionableShards,
  prepareInventory,
  executeSpace,
}) {
  yield* ensureFunding(plan.costs, plan.fundingAmount, synapse, store)

  store.transitionToMigrating()
  const state = store.getState()
  let succeeded = 0
  let failed = 0
  let skippedUploads = 0
  /** @type {bigint[]} */
  const dataSetIds = []

  for (const perSpaceCost of plan.costs.perSpace) {
    if (signal?.aborted) return

    const sourceInventory = buildSpaceInventoryFromStore(
      store,
      perSpaceCost.spaceDID
    )
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

  store.finalizeMigration()
  yield { type: 'state:checkpoint', state }

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

/**
 * Rebuild one space inventory from the store-backed summary and iterators.
 *
 * This keeps the shared migration loop independent from any backend that might
 * stop caching full inventory arrays in `MigrationState`.
 *
 * @param {API.MigrationStore} store
 * @param {API.SpaceDID} spaceDID
 * @returns {API.SpaceInventory | undefined}
 */
export function buildSpaceInventoryFromStore(store, spaceDID) {
  return materializeSpaceInventory(store, spaceDID)
}
