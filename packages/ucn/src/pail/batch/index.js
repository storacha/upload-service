// eslint-disable-next-line no-unused-vars
import * as API from './api.js'
import * as Shard from '@web3-storage/pail/shard'
import { ShardFetcher } from '@web3-storage/pail/shard'
import * as Batch from '@web3-storage/pail/batch'
import { BatchCommittedError } from '@web3-storage/pail/batch'
import * as Base from '../../base/revision.js'

export { BatchCommittedError }

/** @implements {API.Batcher} */
class Batcher {
  #committed = false

  /**
   * @param {object} init
   * @param {API.BlockFetcher} init.blocks Block storage.
   * @param {API.ValueView} init.current Current value view.
   * @param {API.BatcherShardEntry[]} init.entries The entries in this shard.
   * @param {string} init.prefix Key prefix.
   * @param {number} init.version Shard compatibility version.
   * @param {string} init.keyChars Characters allowed in keys, referring to a known character set.
   * @param {number} init.maxKeySize Max key size in bytes.
   * @param {API.ShardBlockView} init.base Original shard this batcher is based on.
   */
  constructor({
    blocks,
    current,
    entries,
    prefix,
    version,
    keyChars,
    maxKeySize,
    base,
  }) {
    this.blocks = blocks
    this.current = current
    this.prefix = prefix
    this.entries = [...entries]
    this.base = base
    this.version = version
    this.keyChars = keyChars
    this.maxKeySize = maxKeySize
    /** @type {API.BatchOperation['ops']} */
    this.ops = []
  }

  /**
   * @param {string} key The key of the value to put.
   * @param {API.UnknownLink} value The value to put.
   * @returns {Promise<void>}
   */
  async put(key, value) {
    if (this.#committed) throw new BatchCommittedError()
    await Batch.put(this.blocks, this, key, value)
    this.ops.push({ type: 'put', key, value })
  }

  async commit() {
    if (this.#committed) throw new BatchCommittedError()
    this.#committed = true

    const res = await Batch.commit(this)

    /** @type {API.Operation} */
    const operation = { type: 'batch', ops: this.ops, root: res.root }
    return {
      revision: await Base.increment(this.current, operation),
      additions: res.additions,
      removals: res.removals,
    }
  }

  /**
   * @param {object} init
   * @param {API.BlockFetcher} init.blocks Block storage.
   * @param {API.ValueView} init.current Current value view.
   */
  static async create({ blocks, current }) {
    const shards = new ShardFetcher(blocks)
    const base = await shards.get(current.root)
    return new Batcher({
      blocks,
      current,
      entries: base.value.entries,
      base,
      ...Shard.configure(base.value),
    })
  }
}

/**
 * @param {API.BlockFetcher} blocks Bucket block storage.
 * @param {API.ValueView} current
 * @returns {Promise<API.Batcher>}
 */
export const create = (blocks, current) => Batcher.create({ blocks, current })
