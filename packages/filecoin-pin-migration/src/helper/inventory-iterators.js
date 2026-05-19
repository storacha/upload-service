/**
 * @import * as API from '../api.js'
 */

/**
 * Adapt store-backed pull rows into the pure `ResolvedShard` shape helpers use.
 *
 * `iterateShards({ kind: 'pull' })` already filters to pull rows, so no extra
 * discriminant guard is needed here.
 *
 * @param {API.MigrationStore} store
 * @param {API.SpaceDID} spaceDID
 * @returns {Iterable<API.ResolvedShard>}
 */
export function* iteratePullShards(store, spaceDID) {
  for (const shard of store.iterateShards(spaceDID, { kind: 'pull' })) {
    if (shard.kind !== 'pull') continue
    yield {
      root: shard.root,
      cid: shard.shardCid,
      pieceCID: /** @type {string} */ (shard.pieceCID),
      sourceURL: shard.sourceURL,
      sizeBytes: shard.sizeBytes,
    }
  }
}
