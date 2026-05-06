/**
 * @import * as RootAPI from '../api.js'
 */

/**
 * @typedef {object} ProviderPieceStatusResult
 * @property {string} shardCid
 * @property {string | null} pieceCID
 * @property {string} status
 * @property {number | null} httpStatus
 * @property {string} [error]
 */

/**
 * Build the minimal shardCID -> pieceCID index needed by staged-shard SP
 * probing. This intentionally omits the reverse map and inventory gap scan.
 *
 * @param {RootAPI.SpaceState} spaceState
 * @param {RootAPI.SpaceInventory} inventory
 */
export function buildShardCIDToPieceIndex(spaceState, inventory) {
  const shardCIDToPieceCID = new Map()

  for (const shard of inventory.shards) {
    shardCIDToPieceCID.set(shard.cid, shard.pieceCID)
  }

  const primaryCopy = spaceState.copies.find((copy) => copy.copyIndex === 0)

  if (primaryCopy) {
    for (const [shardCID, pieceCID] of Object.entries(
      primaryCopy.storedShards
    )) {
      shardCIDToPieceCID.set(shardCID, pieceCID)
    }
  }

  return shardCIDToPieceCID
}

/**
 * @param {RootAPI.SpaceState} spaceState
 * @param {RootAPI.SpaceInventory} inventory
 */
export function buildShardMappings(spaceState, inventory) {
  const pieceCIDToShardCID = new Map()
  const shardCIDToPieceCID = buildShardCIDToPieceIndex(spaceState, inventory)
  const allShardCIDs = new Set()

  for (const shard of inventory.shards) {
    allShardCIDs.add(shard.cid)
    pieceCIDToShardCID.set(shard.pieceCID, shard.cid)
  }

  for (const shard of inventory.shardsToStore) {
    allShardCIDs.add(shard.cid)
  }

  const primaryCopy = spaceState.copies.find((copy) => copy.copyIndex === 0)

  if (primaryCopy) {
    for (const [shardCID, pieceCID] of Object.entries(
      primaryCopy.storedShards
    )) {
      pieceCIDToShardCID.set(pieceCID, shardCID)
    }
  }

  /** @type {string[]} */
  const inventoryShardsMissingPieceCID = []

  for (const shardCID of allShardCIDs) {
    if (!shardCIDToPieceCID.has(shardCID)) {
      inventoryShardsMissingPieceCID.push(shardCID)
    }
  }

  return {
    pieceCIDToShardCID,
    shardCIDToPieceCID,
    inventoryShardsMissingPieceCID,
  }
}

/**
 * @param {object} args
 * @param {string[]} args.shardCIDs
 * @param {Map<string, string>} args.shardCIDToPieceCID
 * @param {string} args.providerURL
 * @param {number} args.concurrency
 * @param {typeof fetch} args.fetcher
 * @returns {Promise<ProviderPieceStatusResult[]>}
 */
export async function checkPiecesOnSP({
  shardCIDs,
  shardCIDToPieceCID,
  providerURL,
  concurrency,
  fetcher,
}) {
  /** @type {ProviderPieceStatusResult[]} */
  const results = []

  for (let i = 0; i < shardCIDs.length; i += concurrency) {
    const batch = shardCIDs.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (shardCid) => {
        const pieceCID = shardCIDToPieceCID.get(shardCid) ?? null
        if (!pieceCID) {
          return {
            shardCid,
            pieceCID,
            status: 'no_piece_cid',
            httpStatus: null,
          }
        }

        try {
          const response = await fetcher(
            `${providerURL}/pdp/piece/${pieceCID}/status`
          )
          if (response.status === 404) {
            return {
              shardCid,
              pieceCID,
              status: 'not_found',
              httpStatus: 404,
            }
          }
          if (!response.ok) {
            return {
              shardCid,
              pieceCID,
              status: 'http_error',
              httpStatus: response.status,
            }
          }

          const body = /** @type {{ status?: string }} */ (
            await response.json()
          )
          return {
            shardCid,
            pieceCID,
            status: body.status ?? 'unknown',
            httpStatus: response.status,
          }
        } catch (error) {
          return {
            shardCid,
            pieceCID,
            status: 'fetch_error',
            httpStatus: null,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })
    )

    results.push(...batchResults)
  }

  return results
}

/**
 * @param {ProviderPieceStatusResult[]} spResults
 * @returns {Record<string, number>}
 */
export function buildStatusBreakdown(spResults) {
  /** @type {Record<string, number>} */
  const statusBreakdown = {}

  for (const result of spResults) {
    statusBreakdown[result.status] = (statusBreakdown[result.status] ?? 0) + 1
  }

  return statusBreakdown
}
