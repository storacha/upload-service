import * as BlobCapabilities from '@storacha/capabilities/space/blob'
import { SpaceDID } from '@storacha/capabilities/utils'
import { servicePrincipal, connection } from '../service.js'

/**
 * @import { MultihashDigest } from 'multiformats'
 * @import { Delegation } from '@ucanto/interface'
 * @import { AssertLocation } from '@web3-storage/content-claims/capability/api'
 * @import { InvocationConfig, RequestOptions } from '../types.js'
 */

/**
 * Replicate a stored Blob by digest to the specified number of nodes.
 *
 * @param {InvocationConfig} conf Configuration
 * for the UCAN invocation. An object with `issuer`, `with` and `proofs`.
 *
 * The `issuer` is the signing authority that is issuing the UCAN
 * invocation(s). It is typically the user _agent_.
 *
 * The `with` is the resource the invocation applies to. It is typically the
 * DID of a space.
 *
 * The `proofs` are a set of capability delegations that prove the issuer
 * has the capability to perform the action.
 *
 * The issuer needs the `space/blob/replicate` delegated capability.
 * @param {object} blob Details of the blob to replicate.
 * @param {MultihashDigest} blob.digest Hash of the blob.
 * @param {number} blob.size Total size of the blob in bytes.
 * @param {Delegation<[AssertLocation]>} site Location commitment describing
 * where the blob may be retrieved.
 * @param {number} replicas Total number of replicas to provision.
 * @param {RequestOptions} [options]
 */
export async function replicate(
  { issuer, with: resource, proofs, audience },
  blob,
  site,
  replicas,
  options = {}
) {
  /* c8 ignore next */
  const conn = options.connection ?? connection
  const receipt = await BlobCapabilities.replicate
    .invoke({
      issuer,
      /* c8 ignore next */
      audience: audience ?? servicePrincipal,
      with: SpaceDID.from(resource),
      nb: input(blob, site, replicas),
      proofs: [...proofs, site],
      nonce: options.nonce,
    })
    .execute(conn)

  if (!receipt.out.ok) {
    throw new Error(`failed ${BlobCapabilities.replicate.can} invocation`, {
      cause: receipt.out.error,
    })
  }

  return receipt.out.ok
}

/** Returns the ability used by an invocation. */
export const ability = BlobCapabilities.replicate.can

/**
 * Returns required input to the invocation.
 *
 * @param {object} blob Details of the blob to replicate.
 * @param {MultihashDigest} blob.digest Hash of the blob.
 * @param {number} blob.size Total size of the blob in bytes.
 * @param {Delegation<[AssertLocation]>} site Location commitment describing
 * where the blob may be retrieved.
 * @param {number} replicas Total number of replicas to provision.
 */
export const input = (blob, site, replicas) => ({
  blob: {
    digest: blob.digest.bytes,
    size: blob.size
  },
  site: site.cid,
  replicas
})
