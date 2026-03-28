import { describe, it, assert, expect } from 'vitest'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Name from '../../src/base/name.js'
import * as Revision from '../../src/pail/revision.js'
import * as Value from '../../src/pail/value.js'
import * as Batch from '../../src/pail/batch/index.js'
import { MemoryBlockstore } from '../../src/base/block.js'

/** @import { BatchOperation } from '../../src/pail/api.js' */

/** @param {string} s */
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
  for (const block of additions) {
    await store.put(block)
  }
}

describe('pail/batch', () => {
  it('should create a batcher', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cid = await createTestCID('init')

    const init = await Revision.v0Put(blocks, 'key', cid)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const batcher = await Batch.create(blocks, value)
    assert(batcher)
    assert(typeof batcher.put === 'function')
    assert(typeof batcher.commit === 'function')
  })

  it('should batch put and commit', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidA = await createTestCID('a')
    const cidB = await createTestCID('b')
    const cidC = await createTestCID('c')

    // create initial pail with one entry
    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    // batch put two more entries
    const batcher = await Batch.create(blocks, value)
    await batcher.put('b', cidB)
    await batcher.put('c', cidC)

    const result = await batcher.commit()
    assert(result.revision)
    assert(result.additions.length > 0)
    const op =
      /** @type {BatchOperation & { root: import('../../src/pail/api.js').ShardLink }} */ (
        result.revision.operation
      )
    assert.equal(op.type, 'batch')
    assert.equal(op.ops.length, 2)

    // verify entries exist
    await storeBlocks(blocks, result.additions)
    const value2 = Value.create(name, result.revision.operation.root, [
      result.revision,
    ])

    const gotB = await Revision.get(blocks, value2, 'b')
    assert(gotB)
    assert.equal(gotB.toString(), cidB.toString())

    const gotC = await Revision.get(blocks, value2, 'c')
    assert(gotC)
    assert.equal(gotC.toString(), cidC.toString())

    // original entry should still be there
    const gotA = await Revision.get(blocks, value2, 'a')
    assert(gotA)
    assert.equal(gotA.toString(), cidA.toString())
  })

  it('should throw on put after commit', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidA = await createTestCID('a')
    const cidB = await createTestCID('b')

    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const batcher = await Batch.create(blocks, value)
    await batcher.put('b', cidB)
    await batcher.commit()

    await expect(batcher.put('c', cidA)).rejects.toThrow()
  })

  it('should throw on double commit', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidA = await createTestCID('a')
    const cidB = await createTestCID('b')

    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const batcher = await Batch.create(blocks, value)
    await batcher.put('b', cidB)
    await batcher.commit()

    await expect(batcher.commit()).rejects.toThrow()
  })

  it('should batch del and commit', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidA = await createTestCID('a')
    const cidB = await createTestCID('b')

    // create initial pail with two entries
    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    const v1 = await Value.from(blocks, name, init.revision)
    await storeBlocks(blocks, v1.additions)

    const put2 = await Revision.put(blocks, v1.value, 'b', cidB)
    await storeBlocks(blocks, put2.additions)
    const v2 = await Value.from(blocks, name, put2.revision)
    await storeBlocks(blocks, v2.additions)
    const value = v2.value

    // batch delete 'a'
    const batcher = await Batch.create(blocks, value)
    await batcher.del('a')

    const result = await batcher.commit()
    assert(result.revision)
    const op =
      /** @type {BatchOperation & { root: import('../../src/pail/api.js').ShardLink }} */ (
        result.revision.operation
      )
    assert.equal(op.type, 'batch')
    assert.equal(op.ops.length, 1)
    assert.equal(op.ops[0].type, 'del')
    assert.equal(op.ops[0].key, 'a')

    // verify 'a' is deleted and 'b' still exists
    await storeBlocks(blocks, result.additions)
    const value2 = Value.create(name, result.revision.operation.root, [
      result.revision,
    ])

    const gotA = await Revision.get(blocks, value2, 'a')
    assert.equal(gotA, undefined)

    const gotB = await Revision.get(blocks, value2, 'b')
    assert(gotB)
    assert.equal(gotB.toString(), cidB.toString())
  })

  it('should throw on del after commit', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidA = await createTestCID('a')

    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const batcher = await Batch.create(blocks, value)
    await batcher.del('a')
    await batcher.commit()

    await expect(batcher.del('a')).rejects.toThrow()
  })

  it('should batch put and del together', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidA = await createTestCID('a')
    const cidB = await createTestCID('b')

    // create initial pail with one entry
    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    // batch: delete 'a' and put 'b'
    const batcher = await Batch.create(blocks, value)
    await batcher.del('a')
    await batcher.put('b', cidB)

    const result = await batcher.commit()
    assert(result.revision)
    const op =
      /** @type {BatchOperation & { root: import('../../src/pail/api.js').ShardLink }} */ (
        result.revision.operation
      )
    assert.equal(op.type, 'batch')
    assert.equal(op.ops.length, 2)

    // verify 'a' is deleted and 'b' exists
    await storeBlocks(blocks, result.additions)
    const value2 = Value.create(name, result.revision.operation.root, [
      result.revision,
    ])

    const gotA = await Revision.get(blocks, value2, 'a')
    assert.equal(gotA, undefined)

    const gotB = await Revision.get(blocks, value2, 'b')
    assert(gotB)
    assert.equal(gotB.toString(), cidB.toString())
  })

  it('should batch many items', async () => {
    const blocks = new MemoryBlockstore()
    const name = await Name.create()
    const cidInit = await createTestCID('init')

    const init = await Revision.v0Put(blocks, 'init', cidInit)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const batcher = await Batch.create(blocks, value)

    const count = 25
    for (let i = 0; i < count; i++) {
      const cid = await createTestCID(`item-${i}`)
      await batcher.put(`key-${String(i).padStart(3, '0')}`, cid)
    }

    const result = await batcher.commit()
    assert(result.revision)
    const op =
      /** @type {BatchOperation & { root: import('../../src/pail/api.js').ShardLink }} */ (
        result.revision.operation
      )
    assert.equal(op.ops.length, count)

    // verify all entries
    await storeBlocks(blocks, result.additions)
    const value2 = Value.create(name, result.revision.operation.root, [
      result.revision,
    ])

    const entries = []
    for await (const [key] of Revision.entries(blocks, value2)) {
      entries.push(key)
    }
    // count + 1 for the 'init' key
    assert.equal(entries.length, count + 1)
  })
})
