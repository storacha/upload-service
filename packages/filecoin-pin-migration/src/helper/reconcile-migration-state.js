import { fetchDataSetPieces } from './fetch-dataset-pieces.js'
import {
  buildShardMappings,
  checkPiecesOnSP,
  buildStatusBreakdown,
} from './sp-piece-status.js'
import {
  buildInventoryCommitView,
  commitKey,
  getFullyCommittedShardCIDs,
} from '../state.js'

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
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string }>} */
  const pulledDeleted = []
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string }>} */
  const storedShardsDeleted = []
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string, rootCid: string }>} */
  const committedDeleted = []
  let hasDiscrepancies = false
  let stateCorrected = false

  for (const spaceDID of targetSpaceDIDs) {
    const inventory = state.spacesInventories[spaceDID]
    const spaceState = state.spaces[spaceDID]
    if (!inventory || !spaceState) continue

    const inventoryCommitView = buildInventoryCommitView(inventory)
    const mappings = buildShardMappings(spaceState, inventory)

    /** @type {API.ReconcileMigrationStateCopyReport[]} */
    const copies = []
    let correctedAnyForSpace = false

    for (const copy of spaceState.copies) {
      const dataSetId = copy.dataSetId
      const hasCommittedStateFromChain = dataSetId != null
      const { pieces, providerURL: fetchedProviderURL } =
        hasCommittedStateFromChain
          ? await fetchDataSetPieces(client, dataSetId)
          : { pieces: [], providerURL: null }
      const providerURL = fetchedProviderURL ?? copy.providerURL ?? null
      const committedReconciliation = reconcileCommittedCopyState({
        copy,
        pieces,
        hasCommittedStateFromChain,
        mappings,
      })
      const stagedReconciliation = await reconcileStagedCopyState({
        copy,
        inventoryCommitView,
        mappings,
        providerURL,
        providerStatusConcurrency,
        fetcher,
        committedKeysForStagedCleanup:
          committedReconciliation.committedKeysForStagedCleanup,
      })

      const replay = applyCopyReconciliation({
        spaceDID,
        copy,
        committedReconciliation,
        stagedReconciliation,
      })
      pulledDeleted.push(...replay.pulledDeleted)
      storedShardsDeleted.push(...replay.storedShardsDeleted)
      committedDeleted.push(...replay.committedDeleted)

      const changes = {
        ...committedReconciliation.changes,
        ...stagedReconciliation.changes,
      }
      const warnings = {
        ...committedReconciliation.warnings,
        ...stagedReconciliation.warnings,
      }

      if (
        hasCopyReportData(changes, warnings) ||
        stagedReconciliation.skippedReason != null
      ) {
        copies.push({
          copyIndex: copy.copyIndex,
          providerId: copy.providerId,
          dataSetId: copy.dataSetId,
          skippedReason: stagedReconciliation.skippedReason,
          changes,
          warnings,
          spCheck: stagedReconciliation.spCheck,
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
    pulledDeleted,
    storedShardsDeleted,
    committedDeleted,
  }
}

/**
 * @param {object} args
 * @param {RootAPI.SpaceCopyState} args.copy
 * @param {API.CommittedDataSetPiece[]} args.pieces
 * @param {boolean} args.hasCommittedStateFromChain
 * @param {ReturnType<typeof buildShardMappings>} args.mappings
 */
function reconcileCommittedCopyState({
  copy,
  pieces,
  hasCommittedStateFromChain,
  mappings,
}) {
  /** @type {Set<string>} */
  const verifiedCommittedCommitKeys = new Set()
  /** @type {string[]} */
  const committedPieceRootsNotFoundInInventory = []
  /** @type {string[]} */
  const unverifiedCommittedPieces = []

  if (hasCommittedStateFromChain) {
    for (const piece of pieces) {
      if (!piece.ipfsRootCID) {
        unverifiedCommittedPieces.push(piece.pieceCID)
        continue
      }

      const matches =
        mappings.pieceCIDToShardEntries.get(piece.pieceCID)?.filter(
          /**
           * @param {{ shardCid: string, root: string }} entry
           */
          (entry) => entry.root === piece.ipfsRootCID
        ) ?? []

      if (matches.length > 0) {
        for (const match of matches) {
          verifiedCommittedCommitKeys.add(commitKey(match.shardCid, match.root))
        }
      } else {
        committedPieceRootsNotFoundInInventory.push(
          `${piece.pieceCID}#${piece.ipfsRootCID}`
        )
      }
    }
  }

  const shouldSuppressCommittedRemovals =
    hasCommittedStateFromChain && unverifiedCommittedPieces.length > 0
  const reconciledCommittedCommitKeys = hasCommittedStateFromChain
    ? shouldSuppressCommittedRemovals
      ? new Set([...copy.committed, ...verifiedCommittedCommitKeys])
      : verifiedCommittedCommitKeys
    : null

  return {
    reconciledCommittedCommitKeys,
    committedKeysForStagedCleanup: hasCommittedStateFromChain
      ? verifiedCommittedCommitKeys
      : null,
    shouldSuppressCommittedRemovals,
    changes: {
      committedAdded: hasCommittedStateFromChain
        ? [...verifiedCommittedCommitKeys].filter(
            (key) => !copy.committed.has(key)
          )
        : [],
      committedRemoved:
        reconciledCommittedCommitKeys && !shouldSuppressCommittedRemovals
          ? [...copy.committed].filter(
              (key) => !reconciledCommittedCommitKeys.has(key)
            )
          : [],
    },
    warnings: {
      committedPieceRootsNotFoundInInventory,
      unverifiedCommittedPieces,
    },
  }
}

/**
 * @param {object} args
 * @param {RootAPI.SpaceCopyState} args.copy
 * @param {RootAPI.InventoryCommitView} args.inventoryCommitView
 * @param {ReturnType<typeof buildShardMappings>} args.mappings
 * @param {string | null} args.providerURL
 * @param {number} args.providerStatusConcurrency
 * @param {typeof fetch} args.fetcher
 * @param {Set<string> | null} args.committedKeysForStagedCleanup
 */
async function reconcileStagedCopyState({
  copy,
  inventoryCommitView,
  mappings,
  providerURL,
  providerStatusConcurrency,
  fetcher,
  committedKeysForStagedCleanup,
}) {
  const stagedShardCIDs = new Set([
    ...copy.pulled,
    ...Object.keys(copy.storedShards),
  ])
  /** @type {API.ReconcileMigrationStateSPCheck | undefined} */
  let spCheck
  /** @type {API.ReconcileMigrationStateCopyReport['skippedReason']} */
  let skippedReason

  /** @type {API.ReconcileMigrationStateChanges['pulledRemovedBecauseCommitted']} */
  const pulledRemovedBecauseCommitted = []
  /** @type {API.ReconcileMigrationStateChanges['removedStagedShardCIDs']} */
  const removedStagedShardCIDs = []
  /** @type {string[]} */
  const unverifiedStagedShardCIDs = []

  if (copy.dataSetId == null && copy.committed.size > 0) {
    skippedReason = 'missing-data-set-id'
  }

  if (committedKeysForStagedCleanup) {
    const reconciledCopy = {
      ...copy,
      // Under suppression we still trust verified committed truth enough to
      // clean staged data, but we do not trust the preserved existing
      // committed entries enough to drive staged cleanup.
      committed: committedKeysForStagedCleanup,
    }
    const fullyCommittedShardCIDs = getFullyCommittedShardCIDs(
      reconciledCopy,
      inventoryCommitView
    )

    for (const shardCID of fullyCommittedShardCIDs) {
      if (copy.pulled.has(shardCID)) {
        pulledRemovedBecauseCommitted.push(shardCID)
      }
      stagedShardCIDs.delete(shardCID)
    }
  }

  /** @type {string[]} */
  const verifiableStagedShardCIDs = []
  for (const shardCID of stagedShardCIDs) {
    if (mappings.shardCIDToPieceCID.has(shardCID)) {
      verifiableStagedShardCIDs.push(shardCID)
    } else {
      unverifiedStagedShardCIDs.push(shardCID)
    }
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
          removedStagedShardCIDs.push(result.shardCid)
          continue
        }

        if (!PULLED_STATUSES.has(result.status)) {
          unverifiedStagedShardCIDs.push(result.shardCid)
        }
      }
    }
  }

  return {
    skippedReason,
    spCheck,
    changes: {
      pulledRemovedBecauseCommitted,
      removedStagedShardCIDs,
    },
    warnings: {
      unverifiedStagedShardCIDs,
    },
  }
}

/**
 * @param {object} args
 * @param {RootAPI.SpaceDID} args.spaceDID
 * @param {RootAPI.SpaceCopyState} args.copy
 * @param {ReturnType<typeof reconcileCommittedCopyState>} args.committedReconciliation
 * @param {Awaited<ReturnType<typeof reconcileStagedCopyState>>} args.stagedReconciliation
 */
function applyCopyReconciliation({
  spaceDID,
  copy,
  committedReconciliation,
  stagedReconciliation,
}) {
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string }>} */
  const pulledDeleted = []
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string }>} */
  const storedShardsDeleted = []
  /** @type {Array<{ spaceDID: RootAPI.SpaceDID, copyIndex: number, shardCid: string, rootCid: string }>} */
  const committedDeleted = []

  if (committedReconciliation.reconciledCommittedCommitKeys) {
    const committedKeysToRemove =
      committedReconciliation.changes.committedRemoved

    if (committedReconciliation.shouldSuppressCommittedRemovals) {
      for (const key of committedReconciliation.changes.committedAdded) {
        copy.committed.add(key)
      }
    } else {
      copy.committed = committedReconciliation.reconciledCommittedCommitKeys
    }

    for (const key of committedKeysToRemove) {
      const [shardCid, rootCid] = key.split('#')
      if (!shardCid || !rootCid) continue
      committedDeleted.push({
        spaceDID,
        copyIndex: copy.copyIndex,
        shardCid,
        rootCid,
      })
    }
  }

  for (const shardCID of stagedReconciliation.changes
    .pulledRemovedBecauseCommitted) {
    if (copy.pulled.delete(shardCID)) {
      pulledDeleted.push({
        spaceDID,
        copyIndex: copy.copyIndex,
        shardCid: shardCID,
      })
    }
  }

  for (const shardCID of stagedReconciliation.changes.removedStagedShardCIDs) {
    if (copy.pulled.delete(shardCID)) {
      pulledDeleted.push({
        spaceDID,
        copyIndex: copy.copyIndex,
        shardCid: shardCID,
      })
    }
    if (shardCID in copy.storedShards) {
      delete copy.storedShards[shardCID]
      storedShardsDeleted.push({
        spaceDID,
        copyIndex: copy.copyIndex,
        shardCid: shardCID,
      })
    }
  }

  return {
    pulledDeleted,
    storedShardsDeleted,
    committedDeleted,
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
    warnings.committedPieceRootsNotFoundInInventory.length > 0 ||
    warnings.unverifiedCommittedPieces.length > 0 ||
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
