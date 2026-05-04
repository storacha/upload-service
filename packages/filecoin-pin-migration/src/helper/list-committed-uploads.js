import { fetchDataSetPieces } from './fetch-dataset-pieces.js'

/**
 * List unique committed uploads for a dataset by grouping committed pieces by
 * their `ipfsRootCID`.
 *
 * @param {object} args
 * @param {import('viem').Client<import('viem').Transport, import('viem').Chain>} args.client
 * @param {bigint} args.dataSetId
 * @returns {Promise<import('./api.js').ListCommittedUploadsResult>}
 */
export async function listCommittedUploads({ client, dataSetId }) {
  const { pieces, providerURL } = await fetchDataSetPieces(client, dataSetId)

  /** @type {Map<string, import('./api.js').CommittedUpload>} */
  const uploadsByRoot = new Map()
  /** @type {string[]} */
  const piecesMissingRoot = []

  for (const piece of pieces) {
    if (!piece.ipfsRootCID) {
      piecesMissingRoot.push(piece.pieceCID)
      continue
    }

    const existing = uploadsByRoot.get(piece.ipfsRootCID)
    if (existing) {
      existing.pieceCIDs.push(piece.pieceCID)
      existing.pieceCount += 1
      continue
    }

    uploadsByRoot.set(piece.ipfsRootCID, {
      ipfsRootCID: piece.ipfsRootCID,
      pieceCount: 1,
      pieceCIDs: [piece.pieceCID],
    })
  }

  return {
    dataSetId,
    providerURL,
    pieceCount: pieces.length,
    uploads: [...uploadsByRoot.values()],
    piecesMissingRoot,
  }
}
