import {
  buildShardCIDToPieceIndex,
  checkPiecesOnSP,
  buildStatusBreakdown,
} from './sp-piece-status.js'
import { iteratePullShards } from './inventory-iterators.js'
import {
  buildInventoryCommitView,
  clearPullProgress as clearPullProgressState,
  clearStoredPiece as clearStoredPieceState,
  getFullyCommittedShardCIDs,
  getInventorySummaryMap,
} from '../state.js'

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
 * @param {RootAPI.MigrationStore} [args.store]
 * @param {RootAPI.SpaceDID[]} [args.spaceDIDs]
 * @param {number} [args.providerStatusConcurrency]
 * @param {typeof fetch} [args.fetcher]
 * @param {(spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string) => void} [args.applyClearPullProgress]
 * @param {(spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string) => void} [args.applyClearStoredPiece]
 * @returns {Promise<API.PruneStagedShardsResult>}
 */
export async function pruneStagedShards({
  state,
  store,
  spaceDIDs,
  providerStatusConcurrency = 10,
  fetcher = fetch,
  applyClearPullProgress = (spaceDID, copyIndex, shardCid) => {
    clearPullProgressState(state, spaceDID, copyIndex, shardCid)
  },
  applyClearStoredPiece = (spaceDID, copyIndex, shardCid) => {
    clearStoredPieceState(state, spaceDID, copyIndex, shardCid)
  },
}) {
  const targetSpaceDIDs =
    spaceDIDs ??
    /** @type {RootAPI.SpaceDID[]} */ (
      Object.keys(getInventorySummaryMap(state))
    )

  /** @type {API.PruneStagedShardsSpaceReport[]} */
  const spaces = []
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string }>} */
  const pulledDeleted = []
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string }>} */
  const storedShardsDeleted = []
  let stateCorrected = false

  for (const spaceDID of targetSpaceDIDs) {
    const inventory = state.spacesInventories?.[spaceDID]
    const spaceState = state.spaces[spaceDID]
    if (!spaceState) continue
    const inventoryBuckets = inventory
      ? inventory
      : store
      ? {
          shards: iteratePullShards(store, spaceDID),
          shardsToStore: store.iterateShardsToStore(spaceDID),
        }
      : undefined
    if (!inventoryBuckets) continue
    const inventoryCommitView = buildInventoryCommitView(inventoryBuckets)
    /** @type {Array<{ copy: RootAPI.SpaceCopyState, stagedShardCIDs: Set<string> }>} */
    const stagedCopies = []

    for (const copy of spaceState.copies) {
      const fullyCommittedShardCIDs = getFullyCommittedShardCIDs(
        copy,
        inventoryCommitView
      )
      const stagedShardCIDs = new Set([
        ...copy.pulled,
        ...Object.keys(copy.storedShards),
      ])
      for (const shardCID of fullyCommittedShardCIDs) {
        stagedShardCIDs.delete(shardCID)
      }

      if (stagedShardCIDs.size > 0) {
        stagedCopies.push({ copy, stagedShardCIDs })
      }
    }

    if (stagedCopies.length === 0) continue

    const shardCIDToPieceCID = buildShardCIDToPieceIndex(
      spaceState,
      inventoryBuckets
    )
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
        if (copy.pulled.has(shardCID)) {
          applyClearPullProgress(spaceDID, copy.copyIndex, shardCID)
          pulledDeleted.push({
            spaceDID,
            copyIndex: copy.copyIndex,
            shardCid: shardCID,
          })
        }
        if (Object.hasOwn(copy.storedShards, shardCID)) {
          applyClearStoredPiece(spaceDID, copy.copyIndex, shardCID)
          storedShardsDeleted.push({
            spaceDID,
            copyIndex: copy.copyIndex,
            shardCid: shardCID,
          })
        }
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
    pulledDeleted,
    storedShardsDeleted,
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
