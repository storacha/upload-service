import * as Server from '@ucanto/server'
import * as W3sBlob from '@storacha/capabilities/web3.storage/blob'
import * as Digest from 'multiformats/hashes/digest'
import * as API from '../../types.js'
import {
  BlobSizeOutsideOfSupportedRange,
  UnsupportedCapability,
} from './lib.js'
import { MAX_UPLOAD_SIZE } from './constants.js'

/**
 * @deprecated
 * @param {API.LegacyBlobServiceContext} context
 * @returns {API.ServiceMethod<API.W3sBlobAllocate, API.W3sBlobAllocateSuccess, API.W3sBlobAllocateFailure>}
 */
export const w3sBlobAllocateProvider = (context) =>
  Server.provide(W3sBlob.allocate, (input) => allocate(context, input))

/**
 * @deprecated
 * @param {API.LegacyBlobServiceContext} context
 * @param {API.ProviderInput<API.W3sBlobAllocate>} input
 */
export const allocate = async (context, { capability }) => {
  // Only service principal can perform an allocation
  if (capability.with !== context.id.did()) {
    return {
      error: new UnsupportedCapability({ capability }),
    }
  }

  const { blob, space } = capability.nb
  const digest = Digest.decode(blob.digest)
  let { size } = blob

  // Verify blob is within the max upload size.
  if (capability.nb.blob.size > MAX_UPLOAD_SIZE) {
    return {
      error: new BlobSizeOutsideOfSupportedRange(
        capability.nb.blob.size,
        MAX_UPLOAD_SIZE
      ),
    }
  }

  const blobFind = await context.registry.find(space, digest)
  if (blobFind.error) {
    if (blobFind.error.name !== 'EntryNotFound') {
      return blobFind
    }
  } else {
    size = 0
  }

  // Check if we already have blob stored
  const hasBlobStore = await context.blobsStorage.has(digest)
  if (hasBlobStore.error) {
    return hasBlobStore
  }

  // If blob is stored, we can allocate it to the space with the allocated size
  if (hasBlobStore.ok) {
    return {
      ok: { size },
    }
  }

  // Get presigned URL for the write target
  const expiresIn = 60 * 60 * 24 // 1 day
  const expiresAt = new Date(Date.now() + expiresIn).toISOString()
  const createUploadUrl = await context.blobsStorage.createUploadUrl(
    digest,
    blob.size,
    expiresIn
  )
  if (createUploadUrl.error) {
    return createUploadUrl
  }

  const address = {
    url: createUploadUrl.ok.url.toString(),
    headers: createUploadUrl.ok.headers,
    expiresAt,
  }

  return {
    ok: {
      size,
      address,
    },
  }
}
