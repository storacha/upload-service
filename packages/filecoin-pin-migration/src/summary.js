/**
 * Derive a migration summary scoped to the inventories and shard bucket used
 * by the current executor run.
 *
 * @param {object} args
 * @param {import('./api.js').MigrationState} args.state
 * @param {Record<import('./api.js').SpaceDID, import('./api.js').SpaceInventory>} args.inventories
 * @param {bigint} args.totalBytes
 * @param {number} args.startedAt
 * @param {(inventory: import('./api.js').SpaceInventory) => Array<{ cid: string }>} args.getActionableShards
 * @returns {import('./api.js').MigrationSummary}
 */
export function deriveMigrationSummary({
  state,
  inventories,
  totalBytes,
  startedAt,
  getActionableShards,
}) {
  let succeeded = 0
  let failed = 0

  for (const [did, inventory] of Object.entries(inventories)) {
    const space = state.spaces[/** @type {import('./api.js').SpaceDID} */ (did)]
    if (!space) continue

    const actionableShardCIDs = new Set(
      getActionableShards(inventory).map((shard) => shard.cid)
    )
    let committedCount = 0

    for (const copy of space.copies) {
      for (const shardCid of copy.committed) {
        if (actionableShardCIDs.has(shardCid)) committedCount++
      }
    }

    succeeded += committedCount
    failed += actionableShardCIDs.size * space.copies.length - committedCount
  }

  return {
    succeeded,
    failed,
    skippedUploads: Object.values(inventories).reduce(
      (sum, inventory) => sum + inventory.skippedUploads.length,
      0
    ),
    dataSetIds: Object.entries(state.spaces).flatMap(([did, space]) =>
      inventories[/** @type {import('./api.js').SpaceDID} */ (did)]
        ? space.copies
            .map((copy) => copy.dataSetId)
            .filter(
              /**
               * @param {bigint | null} id
               * @returns {id is bigint}
               */
              (id) => id != null
            )
        : []
    ),
    totalBytes,
    duration: Date.now() - startedAt,
  }
}
