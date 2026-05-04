import { fetchDataSetPieces } from './fetch-dataset-pieces.js'

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
 * @typedef {object} ProviderPieceStatusResult
 * @property {string} shardCid
 * @property {string | null} pieceCID
 * @property {string} status
 * @property {number | null} httpStatus
 * @property {string} [error]
 */

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

    for (const copy of spaceState.copies) {
      const stagedShardCIDs = new Set([
        ...copy.pulled,
        ...Object.keys(copy.storedShards),
      ])
      const copyHasPersistedState =
        copy.committed.size > 0 || stagedShardCIDs.size > 0

      if (copy.dataSetId == null) {
        if (copyHasPersistedState) {
          copies.push({
            copyIndex: copy.copyIndex,
            providerId: copy.providerId,
            dataSetId: null,
            skippedReason: 'missing-data-set-id',
            changes: createEmptyChanges(),
            warnings: createEmptyWarnings(),
          })
          hasDiscrepancies = true
        }
        continue
      }

      const { pieces, providerURL } = await fetchDataSetPieces(
        client,
        copy.dataSetId
      )
      const onChainPieceSet = new Set(pieces.map((piece) => piece.pieceCID))

      /** @type {Set<string>} */
      const trulyCommittedShardCIDs = new Set()
      /** @type {string[]} */
      const committedPiecesNotFoundInInventory = []

      for (const pieceCID of onChainPieceSet) {
        const shardCID = mappings.pieceCIDToShardCID.get(pieceCID)
        if (shardCID) {
          trulyCommittedShardCIDs.add(shardCID)
        } else {
          committedPiecesNotFoundInInventory.push(pieceCID)
        }
      }

      /** @type {API.ReconcileMigrationStateChanges} */
      const changes = {
        committedAdded: [...trulyCommittedShardCIDs].filter(
          (cid) => !copy.committed.has(cid)
        ),
        committedRemoved: [...copy.committed].filter(
          (cid) => !trulyCommittedShardCIDs.has(cid)
        ),
        pulledRemovedBecauseCommitted: [],
        removedStagedShardCIDs: [],
      }

      for (const shardCID of trulyCommittedShardCIDs) {
        if (copy.pulled.has(shardCID)) {
          changes.pulledRemovedBecauseCommitted.push(shardCID)
        }
        stagedShardCIDs.delete(shardCID)
        copy.pulled.delete(shardCID)
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

      if (verifiableStagedShardCIDs.length > 0) {
        if (!providerURL) {
          skippedReason = 'missing-provider-url'
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
          changes.removedStagedShardCIDs = spResults
            .filter((result) => !PULLED_STATUSES.has(result.status))
            .map((result) => result.shardCid)
        }
      }

      copy.committed = trulyCommittedShardCIDs
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
      }
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
 * @param {object} args
 * @param {string[]} args.shardCIDs
 * @param {Map<string, string>} args.shardCIDToPieceCID
 * @param {string} args.providerURL
 * @param {number} args.concurrency
 * @param {typeof fetch} args.fetcher
 * @returns {Promise<ProviderPieceStatusResult[]>}
 */
async function checkPiecesOnSP({
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
 * @param {RootAPI.SpaceState} spaceState
 * @param {RootAPI.SpaceInventory} inventory
 */
function buildShardMappings(spaceState, inventory) {
  const pieceCIDToShardCID = new Map()
  const shardCIDToPieceCID = new Map()
  const allShardCIDs = new Set()

  for (const shard of inventory.shards) {
    allShardCIDs.add(shard.cid)
    pieceCIDToShardCID.set(shard.pieceCID, shard.cid)
    shardCIDToPieceCID.set(shard.cid, shard.pieceCID)
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
      shardCIDToPieceCID.set(shardCID, pieceCID)
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
 * @returns {API.ReconcileMigrationStateChanges}
 */
function createEmptyChanges() {
  return {
    committedAdded: [],
    committedRemoved: [],
    pulledRemovedBecauseCommitted: [],
    removedStagedShardCIDs: [],
  }
}

/**
 * @returns {API.ReconcileMigrationStateWarnings}
 */
function createEmptyWarnings() {
  return {
    committedPiecesNotFoundInInventory: [],
    unverifiedStagedShardCIDs: [],
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
 * @param {ProviderPieceStatusResult[]} spResults
 * @returns {Record<string, number>}
 */
function buildStatusBreakdown(spResults) {
  /** @type {Record<string, number>} */
  const statusBreakdown = {}

  for (const result of spResults) {
    statusBreakdown[result.status] = (statusBreakdown[result.status] ?? 0) + 1
  }

  return statusBreakdown
}
