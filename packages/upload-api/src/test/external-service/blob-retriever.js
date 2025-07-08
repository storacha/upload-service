import { ok, error } from '@ucanto/core'
import * as API from '../../types.js'
import { BlobNotFound } from '../../blob.js'

/**
 * @param {API.IndexingServiceAPI.Client} indexingService
 * @param {API.ClaimReader} claims
 * @returns {API.BlobRetriever}
 */
export const create = (indexingService, claims) => {
  return {
    /** @type {API.BlobRetriever['stream']} */
    async stream(digest) {
      const queryResult = await indexingService.queryClaims({
        hashes: [digest],
      })
      if (queryResult.error) throw queryResult.error
      for (const [_, claim] of queryResult.ok.claims) {
        if (claim.type === 'assert/location') {
          const res = await fetch(claim.location[0])
          if (!res.body) throw new Error('missing response body')
          return ok(res.body)
        }
      }

      const readResult = await claims.read(digest)
      if (readResult.error) throw readResult.error
      for (const claim of readResult.ok) {
        if (claim.type === 'assert/location') {
          const res = await fetch(claim.location[0])
          if (!res.body) throw new Error('missing response body')
          return ok(res.body)
        }
      }
      return error(new BlobNotFound(digest))
    },
  }
}
