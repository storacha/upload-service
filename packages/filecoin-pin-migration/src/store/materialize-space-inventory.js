/**
 * Rebuild one full space inventory from the store-backed summary and iterators.
 *
 * This is an explicit materialization step for call sites that truly need the
 * legacy full inventory shape. Summary-first backends are free to omit the
 * large arrays from their live `MigrationState`.
 *
 * @param {import('../api.js').MigrationStore} store
 * @param {import('../api.js').SpaceDID} spaceDID
 * @returns {import('../api.js').SpaceInventory | undefined}
 */
export function materializeSpaceInventory(store, spaceDID) {
  const stateInventory = store.getState().spacesInventories?.[spaceDID]
  if (stateInventory) {
    return stateInventory
  }

  const summary = store.getSpaceInventorySummary(spaceDID)
  if (!summary) return undefined

  /** @type {import('../api.js').ResolvedShard[]} */
  const shards = []
  for (const shard of store.iterateShards(spaceDID, { kind: 'pull' })) {
    if (shard.kind !== 'pull') continue
    if (shard.pieceCID == null) continue
    shards.push({
      root: shard.root,
      cid: shard.shardCid,
      pieceCID: shard.pieceCID,
      sourceURL: shard.sourceURL,
      sizeBytes: shard.sizeBytes,
    })
  }

  return {
    did: summary.did,
    ...(summary.name !== undefined ? { name: summary.name } : {}),
    uploads: [...store.iterateUploads(spaceDID)],
    shards,
    shardsToStore: [...store.iterateShardsToStore(spaceDID)],
    skippedUploads: [...store.iterateSkippedUploads(spaceDID)],
    totalBytes: summary.totalBytes,
    totalSizeToMigrate: summary.totalSizeToMigrate,
  }
}
