import { delegate } from '@ucanto/core'
import { generate } from '@ucanto/principal/ed25519'
import { parse } from '@ipld/dag-ucan/did'
import * as ClockCaps from '@web3-storage/clock/capabilities'
import { v0, increment, publish, resolve } from './revision.js'

/** @import * as API from './api.js' */

export { v0, increment, publish, resolve }

class Name {
  /**
   * @param {API.Signer} agent
   * @param {API.Delegation} proof
   */
  constructor (agent, proof) {
    this._agent = agent
    this._id = parse(proof.capabilities[0]?.with)
    this._proof = proof
  }

  did () {
    return this._id.did()
  }

  get agent () {
    return this._agent
  }

  get proof () {
    return this._proof
  }

  toString () {
    return this.did()
  }
}

/**
 * @param {API.Signer} [agent]
 * @returns {Promise<API.Name>}
 */
export const create = async agent => {
  agent = agent ?? await generate()
  const id = await generate()
  const proof = await delegate({
    issuer: id,
    audience: agent,
    capabilities: [{ can: '*', with: id.did() }],
    expiration: Infinity
  })
  return new Name(agent, proof)
}

/**
 * @param {API.Signer} agent
 * @param {API.Delegation} proof
 * @returns {API.Name}
 */
export const from = (agent, proof) => new Name(agent, proof)

/**
 * @param {API.Name} name
 * @param {API.DID} recipient
 * @param {object} [options]
 * @param {boolean} [options.readOnly] Set to `true` to create a delegation that
 * allows read but not write.
 * @param {number} [options.expiration] Timestamp in seconds from Unix epoch
 * after which the delegation is invalid. The default is NO EXPIRATION.
 */
export const grant = (name, recipient, options) => {
  const readOnly = options?.readOnly ?? false
  return delegate({
    issuer: name.agent,
    audience: parse(recipient),
    capabilities: [
      { can: ClockCaps.head.can, with: name.did() },
      ...readOnly ? [{ can: ClockCaps.advance.can, with: name.did() }] : [],
    ],
    proofs: [name.proof],
    expiration: options?.expiration ?? Infinity
  })
}
