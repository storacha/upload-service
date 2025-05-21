import * as API from '../../types.js'
import { ok, error } from '@ucanto/core'
import { equals } from 'multiformats/bytes'

/** @implements {API.BlobAPI.ReplicaStorage} */
export class ReplicaStorage {
  constructor() {
    /** @type {API.BlobAPI.Replica[]} */
    this.data = []
  }

  /**
   * @param {object} key
   * @param {API.SpaceDID} key.space
   * @param {API.MultihashDigest} key.digest
   * @param {API.DID} key.provider
   */
  #get({ space, digest, provider }) {
    return this.data.find(
      (r) =>
        r.provider === provider &&
        r.space === space &&
        equals(r.digest.bytes, digest.bytes)
    )
  }

  /** @type {API.BlobAPI.ReplicaStorage['add']} */
  async add(data) {
    const exists = this.#get(data)
    if (exists) {
      return error(
        /** @type {API.BlobAPI.ReplicaExists} */ ({
          name: 'ReplicaExists',
          message: 'replica already exists',
        })
      )
    }
    this.data.push(data)
    return ok({})
  }

  /** @type {API.BlobAPI.ReplicaStorage['setStatus']} */
  async setStatus(key, status) {
    const replica = this.#get(key)
    if (!replica) {
      return error(
        /** @type {API.BlobAPI.ReplicaNotFound} */ ({
          name: 'ReplicaNotFound',
          message: 'replica not found',
        })
      )
    }
    replica.status = status
    return ok({})
  }

  /** @type {API.BlobAPI.ReplicaStorage['list']} */
  async list({ space, digest }) {
    return ok(
      this.data.filter(
        (r) => r.space === space && equals(r.digest.bytes, digest.bytes)
      )
    )
  }
}
