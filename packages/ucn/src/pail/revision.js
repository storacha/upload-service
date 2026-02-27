import { ShardBlock } from '@web3-storage/pail/shard'
import * as Pail from '@web3-storage/pail'
import { MemoryBlockstore, withCache } from '../base/block.js'
import * as Base from '../base/revision.js'
import * as Value from './value.js'
import * as CRDT from '@web3-storage/pail/crdt'
import { ArchiveSchema, NoValueError } from '../base/revision.js'
export { ArchiveSchema, NoValueError }

/**
 * @import * as API from './api.js'
 */

/**
 * Put a value (a CID) for the given key on an empty shard. This is used to create
 * the initial revision for a name.
 *
 * @param {API.BlockFetcher} blocks Bucket block storage.
 * @param {string} key The key of the value to put.
 * @param {API.UnknownLink} value The value to put.
 * @returns {Promise<API.RevisionResult>}
 */
export const v0Put = async (blocks, key, value) => {
  const shard = await ShardBlock.create()
  blocks = withCache(blocks, new MemoryBlockstore([shard]))
  const result = await Pail.put(blocks, shard.cid, key, value)
  const operation = /** @type {API.Operation} */ ({
    type: 'put',
    root: result.root,
    key,
    value,
  })
  return {
    revision: await Base.v0(operation),
    additions: [shard, ...result.additions],
    removals: result.removals,
  }
}

/**
 * Put a value (a CID) for the given key. If the key exists it's value is
 * overwritten.
 *
 * @param {API.BlockFetcher} blocks Bucket block storage.
 * @param {API.ValueView} current
 * @param {string} key The key of the value to put.
 * @param {API.UnknownLink} value The value to put.
 * @returns {Promise<API.RevisionResult>}
 */
export const put = async (blocks, current, key, value) => {
  const result = await Pail.put(blocks, current.root, key, value)
  const operation = /** @type {API.Operation} */ ({
    type: 'put',
    root: result.root,
    key,
    value,
  })
  return {
    revision: await Base.increment(current, operation),
    additions: result.additions,
    removals: result.removals,
  }
}

/**
 * Delete a given key.
 *
 * @param {API.BlockFetcher} blocks Bucket block storage.
 * @param {API.ValueView} current
 * @param {string} key The key of the value to put.
 * @returns {Promise<API.RevisionResult>}
 */
export const del = async (blocks, current, key) => {
  const result = await Pail.del(blocks, current.root, key)
  const operation = /** @type {API.Operation} */ ({
    type: 'del',
    root: result.root,
    key,
  })
  return {
    revision: await Base.increment(current, operation),
    additions: result.additions,
    removals: result.removals,
  }
}

/**
 * @param {API.BlockFetcher} blocks Bucket block storage.
 * @param {API.ValueView} current The current value view to resolve the key from.
 * @param {string} key The key of the value to retrieve.
 */
export const get = async (blocks, current, key) => {
  return Pail.get(blocks, current.root, key)
}
/**
 * @param {API.BlockFetcher} blocks Bucket block storage.
 * @param {API.ValueView} current The current value view to resolve the key from.
 * @param {API.EntriesOptions} [options]
 */
export const entries = async function* (blocks, current, options) {
  yield* Pail.entries(blocks, current.root, options)
}

/**
 * @type {(event: API.EventBlockView) => API.RevisionView}
 */
export const from = Base.from

/**
 * Encode the revision as a CAR file.
 *
 * @type {(revision: API.RevisionView) => Promise<Uint8Array>}
 */
export const archive = Base.archive

/**
 * Extract a revision from a CAR file.
 *
 * @type {(bytes: Uint8Array) => Promise<API.RevisionView>}
 */
export const extract = Base.extract

/**
 * @type {(revision: API.RevisionView) => Promise<string>}
 */
export const format = Base.format

/** @type {(str: string) => Promise<API.RevisionView>} */
export const parse = Base.parse

/**
 * Publish a revision for the passed name to the network. Fails only if the
 * revision was not able to be published to at least 1 remote.
 *
 * @param {API.BlockFetcher} blocks
 * @param {API.NameView} name
 * @param {API.RevisionView} revision
 * @param {object} [options]
 * @param {API.ClockConnection[]} [options.remotes]
 * @returns {Promise<API.ValueResult>}
 */
export const publish = async (blocks, name, revision, options) => {
  const state = await Base.publish(name, revision, {
    ...options,
    fetcher: blocks,
  })
  blocks = withCache(
    blocks,
    new MemoryBlockstore(state.revision.map((r) => r.event))
  )
  const result = await CRDT.root(
    blocks,
    state.revision.map((r) => r.event.cid)
  )
  return {
    value: Value.create(name, result.root, state.revision),
    additions: result.additions,
    removals: result.removals,
  }
}

/**
 * Resolve the current value for the given name. Fails only if no remotes
 * respond successfully.
 *
 * If all remotes respond with an empty head, i.e. there is no event published
 * to the merkle clock to set the current value then an `NoValueError` is
 * thrown, with a `ERR_NO_VALUE` code.
 *
 * @param {API.BlockFetcher} blocks
 * @param {API.NameView} name
 * @param {object} [options]
 * @param {API.ValueView} [options.base] A known base value to use as the resolution base.
 * @param {API.ClockConnection[]} [options.remotes]
 * @return {Promise<API.ValueResult>}
 * @throws {NoValueError}
 */
export const resolve = async (blocks, name, options) => {
  if (options?.base) {
    blocks = withCache(
      blocks,
      new MemoryBlockstore([...options.base.revision.map((r) => r.event)])
    )
  }
  const state = await Base.resolve(name, { ...options, fetcher: blocks })
  blocks = withCache(
    blocks,
    new MemoryBlockstore(state.revision.map((r) => r.event))
  )
  const result = await CRDT.root(
    blocks,
    state.revision.map((r) => r.event.cid)
  )
  return {
    value: Value.create(name, result.root, state.revision),
    additions: result.additions,
    removals: result.removals,
  }
}
