/**
 * PDP (Proof of Data Possession) Capabilities
 *
 * These can be imported directly with:
 * ```js
 * import * as PDP from '@storacha/capabilities/pdp'
 * ```
 *
 * @module
 */
import { capability, Schema, ok } from '@ucanto/validator'
import { equalWith, and, equal } from './utils.js'

/**
 * `pdp/accept` capability allows an agent to signal acceptance of a blob
 * into a PDP aggregate. The capability confirms that the blob has been
 * included in an aggregate piece with the provided inclusion proof.
 */
export const accept = capability({
  can: 'pdp/accept',
  /**
   * DID of the service accepting the blob.
   */
  with: Schema.did(),
  nb: Schema.struct({
    /**
     * Multihash digest of the blob being accepted.
     */
    blob: Schema.bytes(),
  }),
  derives: (claim, from) => {
    return (
      and(equalWith(claim, from)) ||
      and(equal(claim.nb.blob, from.nb.blob, 'blob')) ||
      ok({})
    )
  },
})

/**
 * `pdp/info` capability allows an agent to request information about
 * a blob's inclusion in PDP aggregates. The response includes the piece
 * CID and a list of aggregates containing the blob with their inclusion proofs.
 */
export const info = capability({
  can: 'pdp/info',
  /**
   * DID of the service providing blob information.
   */
  with: Schema.did(),
  nb: Schema.struct({
    /**
     * Multihash digest of the blob to query.
     */
    blob: Schema.bytes(),
  }),
  derives: (claim, from) => {
    return (
      and(equalWith(claim, from)) ||
      and(equal(claim.nb.blob, from.nb.blob, 'blob')) ||
      ok({})
    )
  },
})

// � We export imports here so they are not omitted in generated typedefs
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Schema }
