import {
  CAR,
  CBOR,
  delegate,
  Schema,
  Delegation,
  sha256,
  isDelegation,
} from '@ucanto/core'
import { generate } from '@ucanto/principal/ed25519'
import { parse as parseDID } from '@ipld/dag-ucan/did'
import { create as createLink, parse as parseLink } from 'multiformats/link'
import { identity } from 'multiformats/hashes/identity'
import { base64 } from 'multiformats/bases/base64'
import * as ClockCaps from '@web3-storage/clock/capabilities'
import { v0, increment, publish, resolve } from './revision.js'

/** @import * as API from './api.js' */

export { v0, increment, publish, resolve }

const version = 'ucn/name@1.0.0'

export const ArchiveSchema = Schema.variant({
  [version]: Schema.link({ version: 1 }),
})

class Name {
  /**
   * @param {API.Signer} agent
   * @param {API.DID} id
   * @param {API.Proof[]} proofs
   */
  constructor(agent, id, proofs) {
    this.agent = agent
    this.id = parseDID(id)
    this.proofs = proofs
  }

  did() {
    return this.id.did()
  }

  toString() {
    return this.did()
  }

  /** @type {API.NameView['grant']} */
  grant(receipient, options) {
    return grant(this, receipient, options)
  }

  async *export() {
    yield* exportDAG(this)
  }

  async archive() {
    return archive(this)
  }
}

/**
 * @param {API.Signer} [agent]
 * @returns {Promise<API.NameView>}
 */
export const create = async (agent) => {
  agent = agent ?? (await generate())
  const id = await generate()
  const proof = await delegate({
    issuer: id,
    audience: agent,
    capabilities: [{ can: '*', with: id.did() }],
    expiration: Infinity,
  })
  return new Name(agent, id.did(), [proof])
}

/**
 * Create a name with the passed agent for signing read/write invocations and
 * required proofs of access. If the name ID is not provided in options it will
 * be derived from the proofs if possible.
 *
 * Required delegated capabilities:
 * - `clock/head`
 *
 * Optional delegated capabilities:
 * - `clock/advance` (required for updates)
 *
 * @param {API.Signer} agent Signer for invocations to read from or write to the
 * merkle clock.
 * @param {API.Proof[]} proofs Proof the passed agent can read from
 * (`clock/head`) or write to (`clock/advance`) the merkle clock.
 * @param {object} [options]
 * @param {API.DID} [options.id] DID of the name. If not provided it will be
 * derived from the proofs if possible.
 * @returns {API.NameView}
 */
export const from = (agent, proofs, options) => {
  let id = options?.id
  if (!id) {
    // derive ID from delegation
    for (const p of proofs) {
      if (!isDelegation(p)) continue
      if (p.audience.did() !== agent.did()) continue
      const cap = p.capabilities.find(
        (c) => c.can === '*' || c.can.startsWith('clock/')
      )
      if (!cap || !cap.with.startsWith('did:')) continue
      id = parseDID(cap.with).did()
      break
    }
    if (!id) {
      throw new Error('could not derive name DID from proofs')
    }
  }

  // Note: this is not full validation - just a best effort check to ensure the
  // we can find a proof that has the right capabilities and match the agent DID
  let hasProofLinks = false
  let hasProofMatch = false
  for (const p of proofs) {
    if (!isDelegation(p)) {
      hasProofLinks = true
      continue
    }
    const isAudienceMatch = p.audience.did() === agent.did()
    if (!isAudienceMatch) continue
    const cap = p.capabilities.find(
      (c) => c.can === '*' || c.can.startsWith('clock/')
    )
    if (!cap) continue
    const isIDMatch = cap.with === 'ucan:*' || cap.with === id
    if (!isIDMatch) continue
    hasProofMatch = true
    break
  }
  if (!hasProofMatch && !hasProofLinks) {
    throw new Error(
      `invalid proof: could not find merkle clock proof for agent: ${agent.did()}`
    )
  }

  return new Name(agent, id, proofs)
}

/**
 * @param {API.NameView} name
 * @returns {AsyncIterableIterator<API.Block>}
 */
export const exportDAG = async function* (name) {
  for (const p of name.proofs) {
    if (isDelegation(p)) {
      yield* p.export()
    }
  }
  const bytes = CBOR.encode({
    id: name.did(),
    proofs: name.proofs.map((p) => (isDelegation(p) ? p.cid : p)),
  })
  const digest = await sha256.digest(bytes)
  const cid = createLink(CBOR.code, digest)
  yield { cid, bytes }
}

/**
 * Encode the name as a CAR file.
 *
 * @param {API.NameView} name
 * @returns {Promise<Uint8Array>}
 */
export const archive = async (name) => {
  let rootBlock
  const blocks = new Map()
  for await (const block of name.export()) {
    blocks.set(block.cid.toString(), block)
    rootBlock = block
  }
  if (!rootBlock) throw new Error('missing root block')
  const variant = await CBOR.write({ [version]: rootBlock.cid })
  return CAR.encode({ roots: [variant], blocks })
}

/**
 * @param {API.Signer} agent
 * @param {Uint8Array} bytes
 */
export const extract = async (agent, bytes) => {
  const { roots, blocks } = CAR.decode(bytes)
  if (roots.length !== 1) {
    throw new Error('unexpected number of roots')
  }

  const variant = CBOR.decode(roots[0].bytes)
  const [, link] = ArchiveSchema.match(variant)
  const rootBlock = blocks.get(String(link))
  if (!rootBlock) {
    throw new Error('missing archive root block')
  }

  const rootValue =
    /** @type {{ id: API.DID, proofs: API.UCANLink[] }} */
    (CBOR.decode(rootBlock.bytes))

  const proofs = rootValue.proofs.map((p) =>
    Delegation.view({ root: p, blocks })
  )
  return new Name(agent, rootValue.id, proofs)
}

/** @param {API.NameView} name */
export const format = async (name) => {
  const bytes = await name.archive()
  const link = createLink(CAR.code, identity.digest(bytes))
  return link.toString(base64)
}

/**
 * @param {API.Signer} agent
 * @param {string} str
 */
export const parse = (agent, str) => {
  const link = parseLink(str, base64)
  if (link.code !== CAR.code) {
    throw new Error(`non CAR codec found: 0x${link.code.toString(16)}`)
  }
  if (link.multihash.code !== identity.code) {
    throw new Error(
      `non identity multihash: 0x${link.multihash.code.toString(16)}`
    )
  }
  return extract(agent, link.multihash.digest)
}

/**
 * Create a delegation allowing the passed receipient to read and/or mutate
 * the current value of the name.
 *
 * Note: if the passed name is _read only_ and proofs contain links then this
 * function will NOT error, since resolution happens at invocation time.
 *
 * @param {API.NameView} name
 * @param {API.DID} recipient
 * @param {API.GrantOptions} [options]
 */
export const grant = async (name, recipient, options) => {
  const readOnly = options?.readOnly ?? false
  if (!readOnly) {
    // best effort check for writable name
    const writeAbilities = ['*', ClockCaps.clock.can, ClockCaps.advance.can]
    let hasProofLinks = false
    let canWrite = false
    for (const p of name.proofs) {
      if (!isDelegation(p)) {
        hasProofLinks = true
        continue
      }
      canWrite = p.capabilities.some((c) => writeAbilities.includes(c.can))
      if (canWrite) {
        break
      }
    }
    if (!hasProofLinks && !canWrite) {
      throw new Error(
        `granting write capability: name not writable: delegated capability not found: "${ClockCaps.advance.can}"`
      )
    }
  }
  return delegate({
    issuer: name.agent,
    audience: parseDID(recipient),
    capabilities: [
      { can: ClockCaps.head.can, with: name.did() },
      ...(readOnly ? [] : [{ can: ClockCaps.advance.can, with: name.did() }]),
    ],
    proofs: name.proofs,
    expiration: options?.expiration ?? Infinity,
  })
}
