import { Blob } from '@storacha/upload-client'
import { SpaceBlob as BlobCapabilities } from '@storacha/capabilities'
import { sha256 } from 'multiformats/hashes/sha2'
import { Base } from '../base.js'

/** @import { AssertLocation } from '@web3-storage/content-claims/capability/api' */

/**
 * Client for interacting with the `blob/*` capabilities.
 */
export class BlobClient extends Base {
  /**
   * Store a Blob to the resource.
   *
   * Required delegated capabilities:
   * - `space/blob/add`
   *
   * @param {Blob} blob - blob data.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async add(blob, options = {}) {
    options = {
      receiptsEndpoint: this._receiptsEndpoint.toString(),
      connection: this._serviceConf.upload,
      ...options,
    }
    const conf = await this._invocationConfig([BlobCapabilities.add.can])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const digest = await sha256.digest(bytes)
    return { digest, ...(await Blob.add(conf, digest, bytes, options)) }
  }

  /**
   * List blobs stored to the resource.
   *
   * Required delegated capabilities:
   * - `space/blob/list`
   *
   * @param {import('../types.js').ListRequestOptions} [options]
   */
  async list(options = {}) {
    const conf = await this._invocationConfig([BlobCapabilities.list.can])
    options.connection = this._serviceConf.upload
    return Blob.list(conf, options)
  }

  /**
   * Remove a stored blob by multihash digest.
   *
   * Required delegated capabilities:
   * - `space/blob/remove`
   *
   * @param {import('multiformats').MultihashDigest} digest - digest of blob to remove.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async remove(digest, options = {}) {
    const conf = await this._invocationConfig([BlobCapabilities.remove.can])
    options.connection = this._serviceConf.upload
    return Blob.remove(conf, digest, options)
  }

  /**
   * Gets a stored blob by multihash digest.
   *
   * @param {import('multiformats').MultihashDigest} digest - digest of blob to get.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async get(digest, options = {}) {
    const conf = await this._invocationConfig([BlobCapabilities.get.can])
    options.connection = this._serviceConf.upload
    return Blob.get(conf, digest, options)
  }

  /**
   * Replicate a blob to the specified number of nodes.
   *
   * @param {object} blob - details of the blob to replicate
   * @param {import('multiformats').MultihashDigest} blob.digest - hash of the blob
   * @param {number} blob.size - size of the blob in bytes
   * @param {import('../types.js').Delegation<[AssertLocation]>} site - location commitment specifying where the blob can be obtained.
   * @param {number} replicas - total number of replicas to provision.
   * @param {import('../types.js').RequestOptions} [options]
   */
  async replicate(blob, site, replicas, options = {}) {
    const conf = await this._invocationConfig([BlobCapabilities.replicate.can])
    options.connection = this._serviceConf.upload
    return Blob.replicate(conf, blob, site, replicas, options)
  }
}
