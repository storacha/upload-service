import { DID } from '@ucanto/server'
import * as dagJSON from '@ipld/dag-json'
import { extract } from '@ucanto/core/delegation'
import * as Space from '@storacha/capabilities/space'

import * as Type from './types.js'

/**
 *
 * @param {Type.CreateDecryptWrappedInvocationOptions} param0
 */
export const createDecryptWrappedInvocation = async ({
  delegationCAR,
  issuer,
  spaceDID,
  resourceCID,
  audience,
  expiration,
}) => {
  const delegation = await extract(delegationCAR)
  if (delegation.error) {
    throw delegation.error
  }

  const invocationOptions = {
    issuer,
    audience: DID.parse(audience),
    with: spaceDID,
    nb: {
      resource: resourceCID,
    },
    expiration: expiration,
    proofs: [delegation.ok],
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
