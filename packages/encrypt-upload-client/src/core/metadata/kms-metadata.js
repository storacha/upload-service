import { CID } from 'multiformats'
import * as dagCBOR from '@ipld/dag-cbor'
import * as Link from 'multiformats/link'
import { sha256 } from 'multiformats/hashes/sha2'
import { CAR, ok, error, Schema } from '@ucanto/core'

import * as Types from '../../types.js'
import { UnknownFormat } from '../errors.js'

export const version = 'encrypted-metadata@0.2'

export const KMSMetadataSchema = Schema.variant({
  [version]: Schema.struct({
    encryptedDataCID: Schema.link(),
    encryptedSymmetricKey: Schema.string(),
    space: Schema.string(), // SpaceDID as string
    kms: Schema.struct({
      provider: Schema.string(),
      keyId: Schema.string(),
      algorithm: Schema.string(),
    }),
  }),
})

export const KMSMetadataInputSchema = Schema.struct({
  encryptedDataCID: Schema.string(),
  encryptedSymmetricKey: Schema.string(),
  space: Schema.string(),
  kms: Schema.struct({
    provider: Schema.string(),
    keyId: Schema.string(),
    algorithm: Schema.string(),
  }),
})

/** @implements {Types.KMSMetadataView} */
class KMSMetadata {
  #encryptedDataCID
  #encryptedSymmetricKey
  #space
  #kms

  /** @param {Types.KMSMetadata|Types.KMSMetadataInput} kmsMetadataInput */
  constructor(kmsMetadataInput) {
    /** @type {Types.KMSMetadata} */
    let kmsMetadata
    if (KMSMetadataInputSchema.is(kmsMetadataInput)) {
      kmsMetadata = parse(
        /** @type {Types.KMSMetadataInput} */ (kmsMetadataInput)
      )
    } else {
      kmsMetadata = /** @type {Types.KMSMetadata} */ (kmsMetadataInput)
    }

    this.#encryptedDataCID = kmsMetadata.encryptedDataCID
    this.#encryptedSymmetricKey = kmsMetadata.encryptedSymmetricKey
    this.#space = kmsMetadata.space
    this.#kms = kmsMetadata.kms
  }

  get encryptedDataCID() {
    return this.#encryptedDataCID
  }

  get encryptedSymmetricKey() {
    return this.#encryptedSymmetricKey
  }

  get space() {
    return this.#space
  }

  get kms() {
    return this.#kms
  }

  archiveBlock() {
    /** @type {Types.KMSMetadata} */
    const input = {
      encryptedDataCID: this.encryptedDataCID,
      encryptedSymmetricKey: this.encryptedSymmetricKey,
      space: this.space,
      kms: this.kms,
    }
    return archiveBlock(input)
  }

  /** @returns {Types.KMSMetadataInput} */
  toJSON() {
    return toJSON(this)
  }
}

/**
 * @param {Types.KMSMetadata|Types.KMSMetadataInput} kmsMetadataInput
 * @returns {Types.KMSMetadataView}
 */
export const create = (kmsMetadataInput) => new KMSMetadata(kmsMetadataInput)

/**
 * @param {Types.KMSMetadataView} kmsMetadata
 * @returns {Types.KMSMetadataInput}
 */
export const toJSON = (kmsMetadata) => ({
  encryptedDataCID: kmsMetadata.encryptedDataCID.toString(),
  encryptedSymmetricKey: kmsMetadata.encryptedSymmetricKey,
  space: kmsMetadata.space,
  kms: kmsMetadata.kms,
})

/**
 * @param {Types.KMSMetadataInput} kmsMetadataInput
 * @returns {Types.KMSMetadata}
 */
export const parse = (kmsMetadataInput) => ({
  encryptedDataCID: CID.parse(kmsMetadataInput.encryptedDataCID),
  encryptedSymmetricKey: kmsMetadataInput.encryptedSymmetricKey,
  space: /** @type {Types.SpaceDID} */ (kmsMetadataInput.space),
  kms: kmsMetadataInput.kms,
})

/**
 * @param {Types.KMSMetadata} kmsMetadataInput
 * @returns {Promise<import('@ucanto/interface').Block>}
 */
export const archiveBlock = async (kmsMetadataInput) => {
  const bytes = dagCBOR.encode({ [version]: kmsMetadataInput })
  const digest = await sha256.digest(bytes)
  const cid = Link.create(dagCBOR.code, digest)
  return { cid, bytes }
}

/**
 * @param {Types.KMSMetadata} kmsMetadata
 * @returns {Promise<Types.Result<Uint8Array>>}
 */
export const archive = async (kmsMetadata) => {
  const block = await archiveBlock(kmsMetadata)
  return ok(CAR.encode({ roots: [block] }))
}

/**
 * @param {Uint8Array} archive
 * @returns {Types.Result<Types.KMSMetadataView, Types.UnknownFormat>}
 */
export const extract = (archive) => {
  const { roots } = CAR.decode(archive)

  if (!roots.length) {
    return error(new UnknownFormat('missing root block'))
  }

  const { code } = roots[0].cid
  if (code !== dagCBOR.code) {
    return error(
      new UnknownFormat(`unexpected root CID codec: 0x${code.toString(16)}`)
    )
  }

  return view({ root: roots[0] })
}

/**
 * @param {object} source
 * @param {Types.IPLDBlock} source.root
 * @returns {Types.Result<Types.KMSMetadataView, Types.UnknownFormat>}
 */
export const view = ({ root }) => {
  const value = dagCBOR.decode(root.bytes)
  const [matchedVersion, kmsMetadataData] = KMSMetadataSchema.match(value)
  switch (matchedVersion) {
    case version: {
      const kmsMetadata = create(
        /** @type {Types.KMSMetadata}*/ (kmsMetadataData)
      )
      return ok(kmsMetadata)
    }
    default:
      return error(
        new UnknownFormat(`unknown KMS metadata version: ${matchedVersion}`)
      )
  }
}
