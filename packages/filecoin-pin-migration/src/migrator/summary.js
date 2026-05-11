import { commitKey } from '../state.js'

/**
 * Derive one space's migration summary contribution scoped to the inventories
 * and shard bucket used by the current executor run.
 *
 * @param {object} args
 * @param {import('../api.js').MigrationState} args.state
 * @param {import('../api.js').SpaceDID} args.spaceDID
 * @param {import('../api.js').SpaceInventory} args.inventory
 * @param {(inventory: import('../api.js').SpaceInventory) => Iterable<{ cid: string, root: string }>} args.getActionableShards
 */
export function summarizeSpaceMigration({
  state,
  spaceDID,
  inventory,
  getActionableShards,
}) {
  const space = state.spaces[spaceDID]
  if (!space) {
    return {
      succeeded: 0,
      failed: 0,
      skippedUploads: inventory.skippedUploads.length,
      dataSetIds: [],
    }
  }

  const actionableCommitKeys = new Set()
  for (const shard of getActionableShards(inventory)) {
    actionableCommitKeys.add(commitKey(shard.cid, shard.root))
  }

  let succeeded = 0
  for (const copy of space.copies) {
    for (const key of copy.committed) {
      if (actionableCommitKeys.has(key)) succeeded += 1
    }
  }

  return {
    succeeded,
    failed: actionableCommitKeys.size * space.copies.length - succeeded,
    skippedUploads: inventory.skippedUploads.length,
    dataSetIds: space.copies
      .map((copy) => copy.dataSetId)
      .filter(
        /**
         * @param {bigint | null} id
         * @returns {id is bigint}
         */
        (id) => id != null
      ),
  }
}
