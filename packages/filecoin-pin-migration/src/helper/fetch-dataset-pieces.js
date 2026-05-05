import { getPdpDataSet } from '@filoz/synapse-core/warm-storage'
import { getPiecesWithMetadata } from '@filoz/synapse-core/pdp-verifier'

/**
 * @import * as API from './api.js'
 */

const PAGE = 100n

/**
 * Fetch all active on-chain pieces for a dataset and normalize the subset of
 * metadata this library cares about.
 *
 * @param {import('viem').Client<import('viem').Transport, import('viem').Chain>} client
 * @param {bigint} dataSetId
 * @returns {Promise<API.FetchDataSetPiecesResult>}
 */
export async function fetchDataSetPieces(client, dataSetId) {
  const dataSet = await getPdpDataSet(client, { dataSetId })
  if (!dataSet) {
    return {
      dataSetId,
      providerURL: null,
      pieces: [],
    }
  }

  const providerURL = dataSet.provider?.pdp?.serviceURL ?? null

  /** @type {API.CommittedDataSetPiece[]} */
  const pieces = []
  let offset = 0n
  let hasMore = true

  while (hasMore) {
    const page = await getPiecesWithMetadata(client, {
      dataSet,
      address: dataSet.payer,
      offset,
      limit: PAGE,
    })

    for (const piece of page.pieces) {
      pieces.push({
        pieceCID: String(piece.cid),
        ipfsRootCID:
          typeof piece.metadata.ipfsRootCID === 'string'
            ? piece.metadata.ipfsRootCID
            : undefined,
      })
    }

    hasMore = page.hasMore
    if (!hasMore) break
    offset += PAGE
  }

  return {
    dataSetId,
    providerURL,
    pieces,
  }
}
