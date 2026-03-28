import {
  advance,
  decodeEventBlock,
  encodeEventBlock,
} from '@web3-storage/pail/clock'
import { CAR, CBOR, Schema } from '@ucanto/core'
import { connect } from '@web3-storage/clock/client'
import * as ClockCaps from '@web3-storage/clock/capabilities'
import { create as createLink, parse as parseLink } from 'multiformats/link'
import { base64 } from 'multiformats/bases/base64'
import { identity } from 'multiformats/hashes/identity'
import {
  MemoryBlockstore,
  withCache,
  TieredBlockFetcher,
  GatewayBlockFetcher,
  withInFlight,
} from './block.js'
import * as State from './state.js'

/** @import * as API from './api.js' */

const version = 'ucn/revision@1.0.0'

export const ArchiveSchema = Schema.variant({
  [version]: Schema.link({ version: 1 }),
})

/**
 * @template O
 * @implements {API.RevisionView<O>}
 */
class Revision {
  /** @param {API.EventBlockView<O>} event */
  constructor(event) {
    this.event = event
  }

  get operation() {
    return this.event.value.data
  }

  get value() {
    return this.operation
  }

  async *export() {
    yield this.event
  }

  async archive() {
    return archive(this)
  }
}

/**
 * Create an initial revision.
 *
 * @template O
 * @param {O} operation
 */
export const v0 = async (operation) => {
  const event = await encodeEventBlock({ parents: [], data: operation })
  return new Revision(event)
}

/**
 * Create a revision of a previous _value_.
 *
 * @template O
 * @param {API.StateView<O>} previous
 * @param {O} next
 */
export const increment = async (previous, next) => {
  const event = await encodeEventBlock({
    parents: previous.revision.map((r) => r.event.cid),
    data: next,
  })
  return new Revision(event)
}

/**
 * @template O
 * @param {API.EventBlockView<O>} event
 */
export const from = (event) => new Revision(event)

/**
 * Encode the revision as a CAR file.
 *
 * @template O
 * @param {API.RevisionView<O>} revision
 * @returns {Promise<Uint8Array>}
 */
export const archive = async (revision) => {
  const blocks = new Map()
  for await (const block of revision.export()) {
    blocks.set(block.cid.toString(), block)
  }
  // Create a descriptor block to describe what this DAG represents.
  const variant = await CBOR.write({ [version]: revision.event.cid })
  return CAR.encode({ roots: [variant], blocks })
}

/** @param {Uint8Array} bytes */
export const extract = async (bytes) => {
  const { roots, blocks } = CAR.decode(bytes)
  if (roots.length !== 1) {
    throw new Error('unexpected number of roots')
  }

  const variant = CBOR.decode(roots[0].bytes)
  const [, link] = ArchiveSchema.match(variant)

  const event = blocks.get(String(link))
  if (!event) {
    throw new Error('missing archive root block')
  }

  return new Revision(await decodeEventBlock(event.bytes))
}

/**
 * @template O
 * @param {API.RevisionView<O>} revision
 */
export const format = async (revision) => {
  const bytes = await revision.archive()
  const link = createLink(CAR.code, identity.digest(bytes))
  return link.toString(base64)
}

/** @param {string} str */
export const parse = (str) => {
  const link = parseLink(str, base64)
  if (link.code !== CAR.code) {
    throw new Error(`non CAR codec found: 0x${link.code.toString(16)}`)
  }
  if (link.multihash.code !== identity.code) {
    throw new Error(
      `non identity multihash: 0x${link.multihash.code.toString(16)}`
    )
  }
  return extract(link.multihash.digest)
}

export const defaultRemotes = [connect()]

/**
 * Publish a revision for the passed name to the network. Fails only if the
 * revision was not able to be published to at least 1 remote.
 *
 * @template O
 * @param {API.NameView} name
 * @param {API.RevisionView<O>} revision
 * @param {object} [options]
 * @param {API.ClockConnection<O>[]} [options.remotes]
 * @param {API.BlockFetcher} [options.fetcher]
 */
export const publish = async (name, revision, options) => {
  const remotes = [...(options?.remotes ?? [])]
  if (!remotes.length) remotes.push(...defaultRemotes)

  const fetcher = withInFlight(
    withCache(
      new TieredBlockFetcher(
        new MemoryBlockstore([revision.event]),
        options?.fetcher ?? new GatewayBlockFetcher()
      )
    )
  )

  /** @type {unknown[]} */
  let errors = []
  const heads = (
    await Promise.all(
      remotes.map(async (r) => {
        try {
          const invocation = ClockCaps.advance.invoke({
            issuer: name.agent,
            audience: r.id,
            with: name.did(),
            nb: { event: revision.event.cid },
            proofs: name.proofs,
          })
          invocation.attach(revision.event)
          const receipt = await invocation.execute(r)
          if (receipt.out.error) throw receipt.out.error
          return receipt.out.ok.head
        } catch (err) {
          errors.push(err)
          return []
        }
      })
    )
  ).flat()

  if (!heads.length) {
    if (errors.length === 1) throw errors[0]
    throw new Error('publishing revision: no remotes advanced their clock', {
      cause: errors,
    })
  }

  let head = revision.event.value.parents
  for (const h of heads) {
    head = await advance(fetcher, head, h)
  }

  // create revisions for each head event
  const revisions = await Promise.all(
    head.map(async (h) => {
      const block = await fetcher.get(h)
      if (!block) throw new Error(`fetching event: ${h}`)
      return new Revision(
        /** @type {API.EventBlockView<O>} */ (
          await decodeEventBlock(block.bytes)
        )
      )
    })
  )

  return State.create(name, revisions)
}

/**
 * Resolve the current value for the given name. Fails only if no remotes
 * respond successfully.
 *
 * If all remotes respond with an empty head, i.e. there is no event published
 * to the merkle clock to set the current value then an `NoValueError` is
 * thrown, with a `ERR_NO_VALUE` code.
 *
 * @template O
 * @param {API.NameView} name
 * @param {object} [options]
 * @param {API.StateView<O>} [options.base] A known base value to use as the resolution base.
 * @param {API.ClockConnection<O>[]} [options.remotes]
 * @param {API.BlockFetcher} [options.fetcher]
 * @return {Promise<API.StateView<O>>}
 * @throws {NoValueError}
 */
export const resolve = async (name, options) => {
  const remotes = [...(options?.remotes ?? [])]
  if (!remotes.length) remotes.push(...defaultRemotes)

  const fetcher = withInFlight(
    withCache(options?.fetcher ?? new GatewayBlockFetcher())
  )

  /** @type {unknown[]} */
  let errors = []
  let heads = await Promise.all(
    remotes.map(async (r) => {
      try {
        const invocation = ClockCaps.head.invoke({
          issuer: name.agent,
          audience: r.id,
          with: name.did(),
          proofs: name.proofs,
        })
        const receipt = await invocation.execute(r)
        if (receipt.out.error) throw receipt.out.error
        return receipt.out.ok.head
      } catch (err) {
        errors.push(err)
        return []
      }
    })
  )

  if (!heads.flat().length) {
    if (!errors.length) throw new NoValueError(`resolving name: no value`)
    if (errors.length === 1) throw errors[0]
    throw new Error('resolving name: no remotes responded successfully', {
      cause: errors,
    })
  }

  heads = heads.filter((h) => h.length !== 0)
  let head = options?.base?.revision.map((r) => r.event.cid) ?? heads[0]

  for (const h of heads.flat()) {
    head = await advance(fetcher, head, h)
  }

  // create revisions for each head event
  const revisions = await Promise.all(
    head.map(async (h) => {
      const block = await fetcher.get(h)
      if (!block) throw new Error(`fetching event: ${h}`)
      return new Revision(await decodeEventBlock(block.bytes))
    })
  )

  return State.create(name, revisions)
}

export class NoValueError extends Error {
  static code = /** @type {const} */ ('ERR_NO_VALUE')
  code = NoValueError.code
}
