import {
  buildShardCIDToPieceIndex,
  checkPiecesOnSP,
  buildStatusBreakdown,
} from './sp-piece-status.js'

/**
 * @import * as API from './api.js'
 * @import * as RootAPI from '../api.js'
 */

const ACKNOWLEDGED_STAGED_STATUSES = new Set([
  'pending',
  'indexing',
  'creating_ad',
  'announced',
  'retrieved',
])

/**
 * Probe persisted staged shards (pulled / storedShards) against the provider
 * and drop only entries the provider definitively no longer has.
 *
 * Mutates `state` in place.
 *
 * @param {object} args
 * @param {RootAPI.MigrationState} args.state
 * @param {RootAPI.SpaceDID[]} [args.spaceDIDs]
 * @param {number} [args.providerStatusConcurrency]
 * @param {typeof fetch} [args.fetcher]
 * @returns {Promise<API.PruneStagedShardsResult>}
 */
export async function pruneStagedShards({
  state,
  spaceDIDs,
  providerStatusConcurrency = 10,
  fetcher = fetch,
}) {
  const targetSpaceDIDs =
    spaceDIDs ??
    /** @type {RootAPI.SpaceDID[]} */ (Object.keys(state.spacesInventories))

  /** @type {API.PruneStagedShardsSpaceReport[]} */
  const spaces = []
  let stateCorrected = false

  for (const spaceDID of targetSpaceDIDs) {
    const inventory = state.spacesInventories[spaceDID]
    const spaceState = state.spaces[spaceDID]
    if (!inventory || !spaceState) continue
    /** @type {Array<{ copy: RootAPI.SpaceCopyState, stagedShardCIDs: Set<string> }>} */
    const stagedCopies = []

    for (const copy of spaceState.copies) {
      const stagedShardCIDs = new Set([
        ...copy.pulled,
        ...Object.keys(copy.storedShards),
      ])
      for (const shardCID of copy.committed) {
        stagedShardCIDs.delete(shardCID)
      }

      if (stagedShardCIDs.size > 0) {
        stagedCopies.push({ copy, stagedShardCIDs })
      }
    }

    if (stagedCopies.length === 0) continue

    const shardCIDToPieceCID = buildShardCIDToPieceIndex(spaceState, inventory)
    /** @type {API.PruneStagedShardsCopyReport[]} */
    const copies = []
    let removedAnyForSpace = false

    for (const { copy, stagedShardCIDs } of stagedCopies) {
      /** @type {string[]} */
      const verifiableStagedShardCIDs = []
      /** @type {string[]} */
      const unverifiedStagedShardCIDs = []

      for (const shardCID of stagedShardCIDs) {
        if (shardCIDToPieceCID.has(shardCID)) {
          verifiableStagedShardCIDs.push(shardCID)
        } else {
          unverifiedStagedShardCIDs.push(shardCID)
        }
      }

      /** @type {API.PruneStagedShardsCopyReport['skippedReason']} */
      let skippedReason
      /** @type {Record<string, number> | undefined} */
      let statusBreakdown
      /** @type {string[]} */
      const removedStagedShardCIDs = []

      if (verifiableStagedShardCIDs.length > 0) {
        const providerURL = copy.providerURL ?? null

        if (!providerURL) {
          skippedReason = 'missing-provider-url'
          unverifiedStagedShardCIDs.push(...verifiableStagedShardCIDs)
        } else {
          const spResults = await checkPiecesOnSP({
            shardCIDs: verifiableStagedShardCIDs,
            shardCIDToPieceCID,
            providerURL,
            concurrency: providerStatusConcurrency,
            fetcher,
          })

          statusBreakdown = buildStatusBreakdown(spResults)

          for (const result of spResults) {
            if (result.status === 'not_found') {
              removedStagedShardCIDs.push(result.shardCid)
              continue
            }

            if (!ACKNOWLEDGED_STAGED_STATUSES.has(result.status)) {
              unverifiedStagedShardCIDs.push(result.shardCid)
            }
          }
        }
      }

      for (const shardCID of removedStagedShardCIDs) {
        copy.pulled.delete(shardCID)
        delete copy.storedShards[shardCID]
      }

      if (removedStagedShardCIDs.length > 0) {
        removedAnyForSpace = true
        stateCorrected = true
      }

      if (
        removedStagedShardCIDs.length > 0 ||
        unverifiedStagedShardCIDs.length > 0 ||
        skippedReason != null
      ) {
        copies.push({
          copyIndex: copy.copyIndex,
          providerId: copy.providerId,
          dataSetId: copy.dataSetId,
          stagedShardCount: stagedShardCIDs.size,
          removedStagedShardCount: removedStagedShardCIDs.length,
          removedStagedShardCIDs,
          unverifiedStagedShardCount: unverifiedStagedShardCIDs.length,
          unverifiedStagedShardCIDs,
          skippedReason,
          statusBreakdown,
        })
      }
    }

    if (removedAnyForSpace) {
      normalizeSpacePhase(spaceState)
    }

    if (copies.length > 0) {
      spaces.push({ spaceDID, copies })
    }
  }

  return {
    stateCorrected,
    spaces,
  }
}

/**
 * @param {RootAPI.SpaceState} space
 */
export function normalizeSpacePhase(space) {
  const hasCommitted = space.copies.some((copy) => copy.committed.size > 0)
  const hasStaged = space.copies.some(
    (copy) => copy.pulled.size > 0 || Object.keys(copy.storedShards).length > 0
  )

  if (!hasCommitted && !hasStaged) {
    space.phase = 'pending'
    return
  }

  if (space.phase !== 'complete') {
    space.phase = 'migrating'
  }
}
