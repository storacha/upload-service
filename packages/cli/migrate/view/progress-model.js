/**
 * @param {{ copyIndex: number, committedPairs: number, preparedShards: number, failedUploads: number }} copy
 * @param {{ totalPreparedShards: number, totalCommittedPairs: number }} totals
 */
export function formatCopyProgressLine(copy, totals) {
  return `prepared ${copy.preparedShards}/${totals.totalPreparedShards}  committed ${copy.committedPairs}/${totals.totalCommittedPairs}  failed ${copy.failedUploads}`
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
export function summarizeInventoryTotals(state) {
  let totalCommittedPairs = 0
  let inventoryCount = 0
  const uniqueShardCIDs = new Set()

  for (const inventory of Object.values(state.spacesInventories)) {
    inventoryCount += 1
    totalCommittedPairs +=
      inventory.shards.length + inventory.shardsToStore.length

    for (const shard of inventory.shards) {
      uniqueShardCIDs.add(shard.cid)
    }

    for (const shard of inventory.shardsToStore) {
      uniqueShardCIDs.add(shard.cid)
    }
  }

  return {
    totalPreparedShards: uniqueShardCIDs.size,
    totalCommittedPairs,
    inventoryPartial: state.phase === 'reading',
    inventoryCount,
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 */
export function summarizeCopyProgress(state) {
  /** @type {Array<{ copyIndex: number, committedPairs: number, preparedShards: number, failedUploads: number }>} */
  const copies = []
  let totalFailedUploads = 0

  for (const space of Object.values(state.spaces)) {
    for (const copy of space.copies) {
      const failedUploads = copy.failedUploads.size
      totalFailedUploads += failedUploads
      let preparedShards = copy.pulled.size
      for (const shardCID in copy.storedShards) {
        if (!copy.pulled.has(shardCID)) {
          preparedShards += 1
        }
      }
      copies.push({
        copyIndex: copy.copyIndex,
        committedPairs: copy.committed.size,
        preparedShards,
        failedUploads,
      })
    }
  }

  return {
    copies,
    totalFailedUploads,
  }
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {ReturnType<typeof summarizeInventoryTotals>} [inventoryTotals]
 */
export function summarizeProgress(
  state,
  inventoryTotals = summarizeInventoryTotals(state)
) {
  const { copies, totalFailedUploads } = summarizeCopyProgress(state)

  return {
    copies,
    totalPreparedShards: inventoryTotals.totalPreparedShards,
    totalCommittedPairs: inventoryTotals.totalCommittedPairs,
    totalFailedUploads,
    inventoryPartial: inventoryTotals.inventoryPartial,
    inventoryCount: inventoryTotals.inventoryCount,
  }
}

/**
 * @typedef {ReturnType<typeof summarizeProgress>} ProgressSummary
 */
