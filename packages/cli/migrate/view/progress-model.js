import { getInventorySummaryMap } from '@storacha/filecoin-pin-migration'

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @returns {Iterable<import('@storacha/filecoin-pin-migration/types').SpaceInventorySummary | import('@storacha/filecoin-pin-migration/types').SpaceInventory>}
 */
function getInventorySummaries(state) {
  return Object.values(getInventorySummaryMap(state))
}

/**
 * @param {{ copyIndex: number, committedPairs: number, preparedShards: number, failedUploads: number }} copy
 * @param {{ totalPreparedShards: number, totalCommittedPairs: number }} totals
 */
export function formatCopyProgressLine(copy, totals) {
  return `prepared ${copy.preparedShards}/${totals.totalPreparedShards}  committed ${copy.committedPairs}/${totals.totalCommittedPairs}  failed ${copy.failedUploads}`
}

/**
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationState} state
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationStore} [store]
 */
export function summarizeInventoryTotals(state, store) {
  let totalCommittedPairs = 0
  let inventoryCount = 0
  let totalPreparedShards = 0
  const uniqueShardCIDs = store ? undefined : new Set()

  for (const inventory of getInventorySummaries(state)) {
    inventoryCount += 1
    const isSummaryInventory =
      'shardsCount' in inventory && 'shardsToStoreCount' in inventory
    totalCommittedPairs += isSummaryInventory
      ? inventory.shardsCount + inventory.shardsToStoreCount
      : inventory.shards.length + inventory.shardsToStore.length

    if (store) {
      totalPreparedShards += store.getSpaceDistinctShardCount(inventory.did)
      continue
    }

    if (isSummaryInventory) {
      throw new TypeError(
        'summarizeInventoryTotals: summary-only runtime states require a MigrationStore to derive total prepared shards'
      )
    }

    for (const shard of inventory.shards) {
      uniqueShardCIDs.add(shard.cid)
    }

    for (const shard of inventory.shardsToStore) {
      uniqueShardCIDs.add(shard.cid)
    }
  }

  return {
    totalPreparedShards: store ? totalPreparedShards : uniqueShardCIDs.size,
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
 * @param {import('@storacha/filecoin-pin-migration/types').MigrationStore} [store]
 * @param {ReturnType<typeof summarizeInventoryTotals>} [inventoryTotals]
 */
export function summarizeProgress(
  state,
  store,
  inventoryTotals = summarizeInventoryTotals(state, store)
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
