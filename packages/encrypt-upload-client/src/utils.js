import { DID } from '@ucanto/server'
import * as dagJSON from '@ipld/dag-json'
import * as Space from '@storacha/capabilities/space'
import * as Type from './types.js'

/**
 *
 * @param {Type.CreateDecryptWrappedInvocationOptions} param0
 */
export const createDecryptWrappedInvocation = async ({
  decryptDelegation,
  issuer,
  spaceDID,
  resourceCID,
  audience,
  expiration,
}) => {
  if (!decryptDelegation) {
    throw new Error('Decrypt delegation is required')
  }

  const invocationOptions = {
    issuer,
    audience: DID.parse(audience),
    with: spaceDID,
    nb: {
      resource: resourceCID,
    },
    expiration: expiration,
    proofs: [decryptDelegation],
  }

  const decryptWrappedInvocation = await Space.decrypt
    .invoke(invocationOptions)
    .delegate()

  const carEncoded = await decryptWrappedInvocation.archive()
  if (carEncoded.error) {
    throw carEncoded.error
  }

  return dagJSON.stringify(carEncoded.ok)
}

/**
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
export function stringToBytes(str) {
  return new TextEncoder().encode(str)
}

/**
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToString(bytes) {
  return new TextDecoder().decode(bytes)
}
