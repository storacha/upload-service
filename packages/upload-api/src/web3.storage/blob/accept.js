import * as Server from '@ucanto/server'
import * as DID from '@ipld/dag-ucan/did'
import * as W3sBlob from '@storacha/capabilities/web3.storage/blob'
import { Assert } from '@web3-storage/content-claims/capability'
import * as Digest from 'multiformats/hashes/digest'
import * as API from '../../types.js'
import {
  AllocatedMemoryHadNotBeenWrittenTo,
  UnsupportedCapability,
} from './lib.js'

/**
 * @deprecated
 * @param {API.LegacyBlobServiceContext} context
 * @returns {API.ServiceMethod<API.W3sBlobAccept, API.W3sBlobAcceptSuccess, API.W3sBlobAcceptFailure>}
 */
export function w3sBlobAcceptProvider(context) {
  return Server.provideAdvanced({
    capability: W3sBlob.accept,
    handler: async ({ capability }) => {
      // Only service principal can perform an allocation
      if (capability.with !== context.id.did()) {
        return {
          error: new UnsupportedCapability({ capability }),
        }
      }

      const { blob, space } = capability.nb
      const digest = Digest.decode(blob.digest)
      // If blob is not stored, we must fail
      const hasBlob = await context.blobsStorage.has(digest)
      if (hasBlob.error) {
        return hasBlob
      } else if (!hasBlob.ok) {
        return {
          error: new AllocatedMemoryHadNotBeenWrittenTo(),
        }
      }

      const createUrl = await context.blobsStorage.createDownloadUrl(digest)
      if (createUrl.error) {
        return createUrl
      }

      const locationClaim = await Assert.location.delegate({
        issuer: context.id,
        audience: DID.parse(space),
        with: context.id.toDIDKey(),
        nb: {
          content: { digest: digest.bytes },
          location: [createUrl.ok],
        },
        expiration: Infinity,
      })

      // Publish this claim to the content claims service
      const pubClaim = await publishLocationClaim(context, {
        space,
        digest,
        size: blob.size,
        location: createUrl.ok,
      })
      if (pubClaim.error) {
        return pubClaim
      }

      // Create result object
      /** @type {API.OkBuilder<API.BlobAcceptSuccess, API.BlobAcceptFailure>} */
      const result = Server.ok({
        site: locationClaim.cid,
      })

      return result.fork(locationClaim)
    },
  })
}

/**
 * @deprecated
 * @param {object} params
 * @param {API.LegacyConcludeServiceContext} params.context
 * @param {API.Invocation<API.HTTPPut>} params.putTask
 * @param {API.Invocation<API.W3sBlobAllocate>} params.allocateTask
 */
export const execW3sAccept = async ({ context, putTask, allocateTask }) => {
  const [allocate] = allocateTask.capabilities
  const blobAccept = W3sBlob.accept.invoke({
    issuer: context.id,
    audience: context.id,
    with: context.id.did(),
    nb: {
      blob: putTask.capabilities[0].nb.body,
      space: allocate.nb.space,
      _put: {
        'ucan/await': ['.out.ok', putTask.cid],
      },
    },
    // ⚠️ We need invocation to be deterministic which is why we use exact
    // same as it is on allocation which will guarantee that expiry is the
    // same regardless when we received `http/put` receipt.
    //
    // ℹ️ This works around the fact that we index receipts by invocation link
    // as opposed to task link which would not care about the expiration.
    expiration: allocateTask.expiration,
  })

  // We do not care about the result we just want receipt to be issued and
  // stored.
  const receipt = await blobAccept.execute(context.getServiceConnection())
  if (receipt.out.error) {
    return receipt.out
  }

  const register = await context.registry.register({
    space: allocate.nb.space,
    cause: allocate.nb.cause.toV1(),
    blob: {
      digest: Digest.decode(allocate.nb.blob.digest),
      size: allocate.nb.blob.size,
    },
  })
  if (register.error) {
    // it's ok if there's already a registration of this blob in this space
    if (register.error.name !== 'EntryExists') {
      return register
    }
  }

  return receipt.out
}

/**
 * @param {API.ClaimsClientContext} ctx
 * @param {{ space: API.SpaceDID, digest: API.MultihashDigest, size: number, location: API.URI }} params
 */
const publishLocationClaim = async (ctx, { digest, size, location }) => {
  const { invocationConfig, connection } = ctx.claimsService
  const { issuer, audience, with: resource, proofs } = invocationConfig
  const res = await Assert.location
    .invoke({
      issuer,
      audience,
      with: resource,
      nb: {
        content: { digest: digest.bytes },
        location: [location],
        range: { offset: 0, length: size },
      },
      expiration: Infinity,
      proofs,
    })
    .execute(connection)
  return res.out
}
