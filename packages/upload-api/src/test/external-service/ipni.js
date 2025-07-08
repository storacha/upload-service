import * as API from '../../types.js'
import { base58btc } from 'multiformats/bases/base58'
import { ok, error } from '@ucanto/core'
import { DigestMap } from '@storacha/blob-index'
import { RecordNotFound } from '../../errors.js'

/** @implements {API.IPNIService} */
export class IPNIService {
  #data

  constructor() {
    this.#data = new DigestMap()
  }

  /** @type {API.IPNIService['publish']} */
  async publish(space, providers, index) {
    for (const [, slices] of index.shards) {
      for (const [digest] of slices) {
        this.#data.set(digest, true)
      }
    }
    return ok({})
  }

  /** @param {API.MultihashDigest} digest */
  async query(digest) {
    const exists = this.#data.has(digest)
    if (!exists) {
      const mhstr = base58btc.encode(digest.bytes)
      return error(new RecordNotFound(`advert not found: ${mhstr}`))
    }
    return ok({})
  }
}
