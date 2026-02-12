import * as CRDT from '@web3-storage/pail/crdt'
import { withCache, MemoryBlockstore } from '../base/block.js'
/** @import * as API from './api.js' */

class Value {
  /**
   * @param {API.NameView} name
   * @param {API.ShardLink} root
   * @param {API.RevisionView[]} revision
   */
  constructor(name, root, revision) {
    this.name = name
    this.root = root
    this.revision = revision
  }
}

/**
 * @param {API.NameView} name
 * @param {API.ShardLink} root
 * @param  {API.RevisionView[]} revision
 * @returns {API.ValueView}
 */
export const create = (name, root, revision) => new Value(name, root, revision)

/**
 *
 * @param {API.BlockFetcher} blocks
 * @param {API.NameView} name
 * @param  {...API.RevisionView} revision
 * @return {Promise<API.ValueResult>}
 */
export const from = async (blocks, name, ...revision) => {
  if (!revision.length) throw new Error('missing revisions')
  blocks = withCache(blocks, new MemoryBlockstore(revision.map((r) => r.event)))
  const result = await CRDT.root(
    blocks,
    revision.map((r) => r.event.cid)
  )
  return {
    value: create(name, result.root, revision),
    additions: result.additions,
    removals: result.removals,
  }
}
