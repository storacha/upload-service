import { CID } from 'multiformats'
import * as dagCBOR from '@ipld/dag-cbor'
import * as Link from 'multiformats/link'
import { sha256 } from 'multiformats/hashes/sha2'
import { CAR, ok, error, Schema } from '@ucanto/core'

import * as Types from '../../types.js'
import { UnknownFormat } from '../errors.js'
import { stringToBytes, bytesToString } from '../../utils.js'

export const version = 'encrypted-metadata@0.1'

export const LitMetadataSchema = Schema.variant({
  [version]: Schema.struct({
    encryptedDataCID: Schema.link(),
    identityBoundCiphertext: Schema.bytes(),
    plaintextKeyHash: Schema.bytes(),
    accessControlConditions: Schema.dictionary({
      key: Schema.text(),
      value: Schema.unknown(),
    }).array(),
  }),
})

export const LitMetadataInputSchema = Schema.struct({
  encryptedDataCID: Schema.string(),
  identityBoundCiphertext: Schema.string(),
  plaintextKeyHash: Schema.string(),
  accessControlConditions: Schema.dictionary({
    key: Schema.text(),
    value: Schema.unknown(),
  }).array(),
})

/** @implements {Types.LitMetadataView} */
class LitEncryptedMetadata {
  #encryptedDataCID
  #identityBoundCiphertext
  #plaintextKeyHash
  #accessControlConditions

  /** @param {Types.LitMetadata|Types.LitMetadataInput} encryptedMetadataInput */
  constructor(encryptedMetadataInput) {
    /** @type {Types.LitMetadata} */
    let encryptedMetadata
    if (LitMetadataInputSchema.is(encryptedMetadataInput)) {
      encryptedMetadata = parse(
        /** @type {Types.LitMetadataInput} */ (encryptedMetadataInput)
      )
    } else {
      encryptedMetadata = /** @type {Types.LitMetadata} */ (
        encryptedMetadataInput
      )
    }

    this.#encryptedDataCID = encryptedMetadata.encryptedDataCID
    this.#identityBoundCiphertext = encryptedMetadata.identityBoundCiphertext
    this.#plaintextKeyHash = encryptedMetadata.plaintextKeyHash
    this.#accessControlConditions =
      encryptedMetadataInput.accessControlConditions
  }

  get encryptedDataCID() {
    return this.#encryptedDataCID
  }

  get identityBoundCiphertext() {
    return this.#identityBoundCiphertext
  }

  get plaintextKeyHash() {
    return this.#plaintextKeyHash
  }

  get accessControlConditions() {
    return this.#accessControlConditions
  }

  archiveBlock() {
    /** @type {Types.LitMetadata} */
    const input = {
      encryptedDataCID: this.encryptedDataCID,
      identityBoundCiphertext: this.identityBoundCiphertext,
      plaintextKeyHash: this.plaintextKeyHash,
      accessControlConditions: this.accessControlConditions,
    }
    return archiveBlock(input)
  }

  /** @returns {Types.LitMetadataInput} */
  toJSON() {
    return toJSON(this)
  }
}

/**
 * @param {Types.LitMetadata|Types.LitMetadataInput} encryptedMetadataInput
 * @returns {Types.LitMetadataView}
 */
export const create = (encryptedMetadataInput) =>
  new LitEncryptedMetadata(encryptedMetadataInput)

/**
 * @param {Types.LitMetadataView} encryptedMetadata
 * @returns {Types.LitMetadataInput}
 */
export const toJSON = (encryptedMetadata) => ({
  encryptedDataCID: encryptedMetadata.encryptedDataCID.toString(),
  identityBoundCiphertext: bytesToString(
    encryptedMetadata.identityBoundCiphertext
  ),
  plaintextKeyHash: bytesToString(encryptedMetadata.plaintextKeyHash),
  accessControlConditions: encryptedMetadata.accessControlConditions,
})

/**
 * @param {Types.LitMetadataInput} encryptedMetadataInput
 * @returns {Types.LitMetadata}
 */
export const parse = (encryptedMetadataInput) => ({
  encryptedDataCID: CID.parse(encryptedMetadataInput.encryptedDataCID),
  identityBoundCiphertext: stringToBytes(
    encryptedMetadataInput.identityBoundCiphertext
  ),
  plaintextKeyHash: stringToBytes(encryptedMetadataInput.plaintextKeyHash),
  accessControlConditions: encryptedMetadataInput.accessControlConditions,
})

/**
 * @param {Types.LitMetadata} encryptedMetadataInput
 * @returns {Promise<import('@ucanto/interface').Block>}
 */
export const archiveBlock = async (encryptedMetadataInput) => {
  const bytes = dagCBOR.encode({ [version]: encryptedMetadataInput })
  const digest = await sha256.digest(bytes)
  const cid = Link.create(dagCBOR.code, digest)
  return { cid, bytes }
}

/**
 * @param {Types.LitMetadata} encryptedMetadata
 * @returns {Promise<Types.Result<Uint8Array>>}
 */
export const archive = async (encryptedMetadata) => {
  const block = await archiveBlock(encryptedMetadata)
  return ok(CAR.encode({ roots: [block] }))
}

/**
 * @param {Uint8Array} archive
 * @returns {Types.Result<Types.LitMetadataView, Types.UnknownFormat>}
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
 * @returns {Types.Result<Types.LitMetadataView, Types.UnknownFormat>}
 */
export const view = ({ root }) => {
  const value = dagCBOR.decode(root.bytes)
  const [matchedVersion, encryptedMetadataData] = LitMetadataSchema.match(value)
  switch (matchedVersion) {
    case version: {
      const encryptedMetadata = create(
        /** @type {Types.LitMetadata}*/ (encryptedMetadataData)
      )
      return ok(encryptedMetadata)
    }
    default:
      return error(
        new UnknownFormat(`unknown Lit metadata version: ${matchedVersion}`)
      )
  }
}
