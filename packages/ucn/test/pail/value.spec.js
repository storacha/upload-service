import { describe, it, assert, expect } from 'vitest'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Name from '../../src/base/name.js'
import * as PailRevision from '../../src/pail/revision.js'
import * as Value from '../../src/pail/value.js'
import { MemoryBlockstore } from '../../src/base/block.js'

/**
 * @param {string} s
 */
const createTestCID = async (s) => {
  const bytes = new TextEncoder().encode(s)
  const hash = await sha256.digest(bytes)
  return CID.create(1, 0x55, hash)
}

/**
 * @param {MemoryBlockstore} store
 * @param {Array<import('multiformats').Block>} additions
 */
const storeBlocks = async (store, additions) => {
  for (const block of additions) await store.put(block)
}

describe('pail/value', () => {
  it('should create a value directly', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cid = await createTestCID('a')

    const init = await PailRevision.v0Put(blocks, 'a', cid)
    await storeBlocks(blocks, init.additions)

    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])
    assert.equal(value.name.did(), name.did())
    assert.equal(value.root.toString(), init.revision.operation.root.toString())
    assert.equal(value.revision.length, 1)
  })

  it('should create a value from revisions', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cid = await createTestCID('a')

    const init = await PailRevision.v0Put(blocks, 'a', cid)
    await storeBlocks(blocks, init.additions)

    const result = await Value.from(blocks, name, init.revision)
    assert(result.value)
    assert.equal(result.value.name.did(), name.did())
    assert.equal(result.value.revision.length, 1)
    assert(result.value.root)
  })

  it('should return additions and removals from Value.from', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cid = await createTestCID('a')

    const init = await PailRevision.v0Put(blocks, 'a', cid)
    await storeBlocks(blocks, init.additions)

    const result = await Value.from(blocks, name, init.revision)
    assert(Array.isArray(result.additions))
    assert(Array.isArray(result.removals))
  })

  it('should throw when no revisions provided', async () => {
    const name = await Name.create()
    const blocks = new MemoryBlockstore()
    await expect(Value.from(blocks, name)).rejects.toThrow(/missing revisions/)
  })
})
