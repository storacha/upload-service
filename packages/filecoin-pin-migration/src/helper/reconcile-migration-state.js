import { fetchDataSetPieces } from './fetch-dataset-pieces.js'
import {
  buildShardMappings,
  checkPiecesOnSP,
  buildStatusBreakdown,
} from './sp-piece-status.js'

/**
 * @import * as API from './api.js'
 * @import * as RootAPI from '../api.js'
 */

const PULLED_STATUSES = new Set([
  'pending',
  'indexing',
  'creating_ad',
  'announced',
  'retrieved',
])

/**
 * Reconcile persisted migration state against on-chain committed pieces and
 * provider piece status checks. Mutates `state` in place.
 *
 * @param {object} args
 * @param {RootAPI.MigrationState} args.state
 * @param {import('viem').Client<import('viem').Transport, import('viem').Chain>} args.client
 * @param {RootAPI.SpaceDID[]} [args.spaceDIDs]
 * @param {number} [args.providerStatusConcurrency]
 * @param {typeof fetch} [args.fetcher]
 * @returns {Promise<API.ReconcileMigrationStateResult>}
 */
export async function reconcileMigrationState({
  state,
  client,
  spaceDIDs,
  providerStatusConcurrency = 10,
  fetcher = fetch,
}) {
  const targetSpaceDIDs =
    spaceDIDs ??
    /** @type {RootAPI.SpaceDID[]} */ (Object.keys(state.spacesInventories))

  /** @type {API.ReconcileMigrationStateSpaceReport[]} */
  const spaces = []
  let hasDiscrepancies = false
  let stateCorrected = false

  for (const spaceDID of targetSpaceDIDs) {
    const inventory = state.spacesInventories[spaceDID]
    const spaceState = state.spaces[spaceDID]
    if (!inventory || !spaceState) continue

    const mappings = buildShardMappings(spaceState, inventory)

    /** @type {API.ReconcileMigrationStateCopyReport[]} */
    const copies = []
    let correctedAnyForSpace = false

    for (const copy of spaceState.copies) {
      const stagedShardCIDs = new Set([
        ...copy.pulled,
        ...Object.keys(copy.storedShards),
      ])
      const dataSetId = copy.dataSetId
      const hasCommittedStateFromChain = dataSetId != null
      const { pieces, providerURL: fetchedProviderURL } =
        hasCommittedStateFromChain
          ? await fetchDataSetPieces(client, dataSetId)
          : { pieces: [], providerURL: null }
      const providerURL = fetchedProviderURL ?? copy.providerURL ?? null
      const onChainPieceSet = new Set(pieces.map((piece) => piece.pieceCID))

      /** @type {Set<string> | null} */
      const trulyCommittedShardCIDs = hasCommittedStateFromChain
        ? new Set()
        : null
      /** @type {string[]} */
      const committedPiecesNotFoundInInventory = []

      if (trulyCommittedShardCIDs) {
        for (const pieceCID of onChainPieceSet) {
          const shardCID = mappings.pieceCIDToShardCID.get(pieceCID)
          if (shardCID) {
            trulyCommittedShardCIDs.add(shardCID)
          } else {
            committedPiecesNotFoundInInventory.push(pieceCID)
          }
        }
      }

      /** @type {API.ReconcileMigrationStateChanges} */
      const changes = {
        committedAdded: trulyCommittedShardCIDs
          ? [...trulyCommittedShardCIDs].filter(
              (cid) => !copy.committed.has(cid)
            )
          : [],
        committedRemoved: trulyCommittedShardCIDs
          ? [...copy.committed].filter(
              (cid) => !trulyCommittedShardCIDs.has(cid)
            )
          : [],
        pulledRemovedBecauseCommitted: [],
        removedStagedShardCIDs: [],
      }

      if (trulyCommittedShardCIDs) {
        for (const shardCID of trulyCommittedShardCIDs) {
          if (copy.pulled.has(shardCID)) {
            changes.pulledRemovedBecauseCommitted.push(shardCID)
          }
          stagedShardCIDs.delete(shardCID)
          copy.pulled.delete(shardCID)
        }
      }

      /** @type {string[]} */
      const verifiableStagedShardCIDs = []
      /** @type {string[]} */
      const unverifiedStagedShardCIDs = []

      for (const shardCID of stagedShardCIDs) {
        if (mappings.shardCIDToPieceCID.has(shardCID)) {
          verifiableStagedShardCIDs.push(shardCID)
        } else {
          unverifiedStagedShardCIDs.push(shardCID)
        }
      }

      /** @type {API.ReconcileMigrationStateSPCheck | undefined} */
      let spCheck
      /** @type {API.ReconcileMigrationStateCopyReport['skippedReason']} */
      let skippedReason

      if (copy.dataSetId == null && copy.committed.size > 0) {
        skippedReason = 'missing-data-set-id'
      }

      if (verifiableStagedShardCIDs.length > 0) {
        if (!providerURL) {
          skippedReason ??= 'missing-provider-url'
          unverifiedStagedShardCIDs.push(...verifiableStagedShardCIDs)
        } else {
          const spResults = await checkPiecesOnSP({
            shardCIDs: verifiableStagedShardCIDs,
            shardCIDToPieceCID: mappings.shardCIDToPieceCID,
            providerURL,
            concurrency: providerStatusConcurrency,
            fetcher,
          })

          spCheck = {
            statusBreakdown: buildStatusBreakdown(spResults),
          }

          for (const result of spResults) {
            if (result.status === 'not_found') {
              changes.removedStagedShardCIDs.push(result.shardCid)
              continue
            }

            if (!PULLED_STATUSES.has(result.status)) {
              unverifiedStagedShardCIDs.push(result.shardCid)
            }
          }
        }
      }

      if (trulyCommittedShardCIDs) {
        copy.committed = trulyCommittedShardCIDs
      }
      for (const shardCID of changes.removedStagedShardCIDs) {
        copy.pulled.delete(shardCID)
        delete copy.storedShards[shardCID]
      }

      const warnings = {
        committedPiecesNotFoundInInventory,
        unverifiedStagedShardCIDs,
      }

      if (hasCopyReportData(changes, warnings) || skippedReason != null) {
        copies.push({
          copyIndex: copy.copyIndex,
          providerId: copy.providerId,
          dataSetId: copy.dataSetId,
          skippedReason,
          changes,
          warnings,
          spCheck,
        })
        hasDiscrepancies = true
      }

      if (
        changes.committedAdded.length > 0 ||
        changes.committedRemoved.length > 0 ||
        changes.pulledRemovedBecauseCommitted.length > 0 ||
        changes.removedStagedShardCIDs.length > 0
      ) {
        stateCorrected = true
        correctedAnyForSpace = true
      }
    }

    if (correctedAnyForSpace) {
      normalizeReconciledSpacePhase(spaceState, inventory)
    }

    if (
      mappings.inventoryShardsMissingPieceCID.length > 0 ||
      copies.length > 0
    ) {
      spaces.push({
        spaceDID,
        inventoryShardsMissingPieceCID: mappings.inventoryShardsMissingPieceCID,
        copies,
      })

      if (mappings.inventoryShardsMissingPieceCID.length > 0) {
        hasDiscrepancies = true
      }
    }
  }

  return {
    hasDiscrepancies,
    stateCorrected,
    spaces,
  }
}

/**
 * @param {API.ReconcileMigrationStateChanges} changes
 * @param {API.ReconcileMigrationStateWarnings} warnings
 */
function hasCopyReportData(changes, warnings) {
  return (
    changes.committedAdded.length > 0 ||
    changes.committedRemoved.length > 0 ||
    changes.pulledRemovedBecauseCommitted.length > 0 ||
    changes.removedStagedShardCIDs.length > 0 ||
    warnings.committedPiecesNotFoundInInventory.length > 0 ||
    warnings.unverifiedStagedShardCIDs.length > 0
  )
}

/**
 * @param {RootAPI.SpaceState} space
 * @param {RootAPI.SpaceInventory} inventory
 */
function normalizeReconciledSpacePhase(space, inventory) {
  const totalShards = inventory.shards.length + inventory.shardsToStore.length
  const hasCommitted = space.copies.some((copy) => copy.committed.size > 0)
  const hasStaged = space.copies.some(
    (copy) => copy.pulled.size > 0 || Object.keys(copy.storedShards).length > 0
  )
  const allComplete = space.copies.every(
    (copy) => copy.committed.size === totalShards
  )

  if (!hasCommitted && !hasStaged) {
    space.phase = 'pending'
    return
  }

  if (hasStaged) {
    space.phase = 'migrating'
    return
  }

  space.phase = allComplete ? 'complete' : 'incomplete'
}
