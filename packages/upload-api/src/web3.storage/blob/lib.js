import { Failure } from '@ucanto/server'
import * as W3sBlob from '@storacha/capabilities/web3.storage/blob'
import * as API from '../../types.js'

export const AllocatedMemoryHadNotBeenWrittenToName =
  'AllocatedMemoryHadNotBeenWrittenTo'
export class AllocatedMemoryHadNotBeenWrittenTo extends Failure {
  get name() {
    return AllocatedMemoryHadNotBeenWrittenToName
  }

  describe() {
    return `Blob not found`
  }
}

export const BlobSizeOutsideOfSupportedRangeName =
  'BlobSizeOutsideOfSupportedRange'
export class BlobSizeOutsideOfSupportedRange extends Failure {
  /**
   * @param {number} blobSize
   * @param {number} maxUploadSize
   */
  constructor(blobSize, maxUploadSize) {
    super()
    this.blobSize = blobSize
    this.maxUploadSize = maxUploadSize
  }

  get name() {
    return BlobSizeOutsideOfSupportedRangeName
  }

  describe() {
    return `Blob size ${this.blobSize} exceeded maximum size limit: ${this.maxUploadSize}, consider splitting it into blobs that fit limit.`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      maxUploadSize: this.maxUploadSize,
      blobSize: this.blobSize,
    }
  }
}

export class UnsupportedCapability extends Failure {
  /**
   * @param {object} source
   * @param {API.Capability} source.capability
   */
  constructor({ capability: { with: subject, can } }) {
    super()

    this.capability = { with: subject, can }
  }
  get name() {
    return /** @type {const} */ ('UnsupportedCapability')
  }
  describe() {
    return `${this.capability.with} does not have a "${this.capability.can}" capability provider`
  }
}

/** @param {API.ProviderDID} s */
export const isW3sProvider = (s) => s.endsWith('web3.storage')

/**
 * @param {API.Invocation} i
 * @returns {i is API.Invocation<import('@web3-storage/upload-api/types').BlobAllocate>}
 */
export const isW3sBlobAllocateTask = (i) =>
  i.capabilities[0].can === W3sBlob.allocate.can
