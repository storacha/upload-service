import { CAR } from '@ucanto/core'
import { importDAG, extract } from '@ucanto/core/delegation'
import { create as createLink, parse as parseLink } from 'multiformats/link'
import { base64 } from 'multiformats/bases/base64'
import { identity } from 'multiformats/hashes/identity'

/** @import * as API from './api.js' */

/**
 * Parses a base64 encoded CIDv1 CAR of proofs (delegations).
 *
 * @param {string} str Base64 encoded CAR file.
 */
export const parse = async (str) => {
  try {
    const cid = parseLink(str, base64)
    if (cid.code !== CAR.code) {
      throw new Error(`non CAR codec found: 0x${cid.code.toString(16)}`)
    }
    if (cid.multihash.code !== identity.code) {
      throw new Error(
        `non identity multihash: 0x${cid.multihash.code.toString(16)}`
      )
    }

    try {
      const { ok, error } = await extract(cid.multihash.digest)
      if (error)
        throw new Error('failed to extract delegation', { cause: error })
      return ok
    } catch {
      // Before `delegation.archive()` we used `delegation.export()` to create
      // a plain CAR file of blocks.
      return legacyExtract(cid.multihash.digest)
    }
  } catch {
    // At one point we recommended piping output directly to base64 encoder:
    // `w3 delegation create did:key... --can 'store/add' | base64`
    return legacyExtract(base64.baseDecode(str))
  }
}

/**
 * Reads a plain CAR file, assuming the last block is the delegation root.
 *
 * @param {Uint8Array} bytes
 */
const legacyExtract = async (bytes) => {
  const { blocks } = CAR.decode(bytes)
  return importDAG(blocks.values())
}

/**
 * @param {API.Delegation} proof
 */
export const format = async (proof) => {
  const res = await proof.archive()
  if (res.error) throw res.error
  const idCid = createLink(CAR.code, identity.digest(res.ok))
  return idCid.toString(base64)
}
