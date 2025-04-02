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
    if (proof.audience.did() !== agent.did()) {
      throw new Error(`invalid proof: delegation is for ${proof.audience.did()} but agent is ${agent.did()}`)
    }
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

  /** @type {API.Name['grant']} */
  grant (receipient, options) {
    return grant(this, receipient, options)
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
 * Create a delegation allowing the passed receipient to read and/or mutate
 * the current value of the name.
 *
 * @param {API.Name} name
 * @param {API.DID} recipient
 * @param {API.GrantOptions} [options]
 */
export const grant = async (name, recipient, options) => {
  const readOnly = options?.readOnly ?? false
  if (!readOnly) {
    const canWrite = name.proof.capabilities.some(c => ['*', ClockCaps.clock.can, ClockCaps.advance.can].includes(c.can))
    if (!canWrite) {
      throw new Error(`granting write capability: name not writable: delegated capability not found: "${ClockCaps.advance.can}"`)
    }
  }
  return delegate({
    issuer: name.agent,
    audience: parse(recipient),
    capabilities: [
      { can: ClockCaps.head.can, with: name.did() },
      ...readOnly ? [] : [{ can: ClockCaps.advance.can, with: name.did() }],
    ],
    proofs: [name.proof],
    expiration: options?.expiration ?? Infinity
  })
}
