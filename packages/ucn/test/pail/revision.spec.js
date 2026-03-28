import { describe, it, assert, expect } from 'vitest'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as CAR from '@ucanto/transport/car'
import { connect } from '@ucanto/client'
import * as Name from '../../src/base/name.js'
import * as Revision from '../../src/pail/revision.js'
import * as Value from '../../src/pail/value.js'
import { MemoryBlockstore } from '../../src/base/block.js'
import { createServer, createService } from '../../src/server/index.js'
import { MemoryHeadStorage, fixtures } from '../helpers.js'

/** @import * as API from '../../src/pail/api.js' */

/** @param {string} s */
const createTestCID = async (s) => {
  const bytes = new TextEncoder().encode(s)
  const hash = await sha256.digest(bytes)
  return CID.create(1, 0x55, hash)
}

/**
 * Helper that stores additions into a blockstore.
 *
 * @param {MemoryBlockstore} store
 * @param {Array<import('multiformats').Block>} additions
 */
const storeBlocks = async (store, additions) => {
  for (const block of additions) {
    await store.put(block)
  }
}

/**
 * @param {import('@ucanto/principal/ed25519').Signer.Signer} id
 * @param {import('../../src/server/api.js').Service<any>} service
 * @returns {API.ClockConnection}
 */
const createRemote = (id, service) => {
  const server = createServer(id, service)
  return /** @type {any} */ (
    connect({ id, codec: CAR.outbound, channel: server })
  )
}

describe('pail/revision', () => {
  it('should create initial revision with v0Put', async () => {
    const blocks = new MemoryBlockstore()
    const cid = await createTestCID('value-a')
    const result = await Revision.v0Put(blocks, 'key-a', cid)
    assert(result.revision)
    assert(result.additions.length > 0)
    const op = /** @type {API.PutOperation & { root: API.ShardLink }} */ (
      result.revision.operation
    )
    assert.equal(op.type, 'put')
    assert.equal(op.key, 'key-a')
    assert.equal(op.value.toString(), cid.toString())
    assert(result.revision.operation.root)
  })

  it('should put a value on an existing pail', async () => {
    const blocks = new MemoryBlockstore()
    const cidA = await createTestCID('value-a')
    const cidB = await createTestCID('value-b')
    const name = await Name.create()

    // create initial
    const init = await Revision.v0Put(blocks, 'key-a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    // put another key
    const result = await Revision.put(blocks, value, 'key-b', cidB)
    assert(result.revision)
    const op = /** @type {API.PutOperation & { root: API.ShardLink }} */ (
      result.revision.operation
    )
    assert.equal(op.type, 'put')
    assert.equal(op.key, 'key-b')
    assert.equal(op.value.toString(), cidB.toString())
  })

  it('should get a value by key', async () => {
    const blocks = new MemoryBlockstore()
    const cidA = await createTestCID('value-a')
    const name = await Name.create()

    const init = await Revision.v0Put(blocks, 'key-a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const got = await Revision.get(blocks, value, 'key-a')
    assert(got)
    assert.equal(got.toString(), cidA.toString())
  })

  it('should return undefined for missing key', async () => {
    const blocks = new MemoryBlockstore()
    const cidA = await createTestCID('value-a')
    const name = await Name.create()

    const init = await Revision.v0Put(blocks, 'key-a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const got = await Revision.get(blocks, value, 'nonexistent')
    assert.equal(got, undefined)
  })

  it('should delete a key', async () => {
    const blocks = new MemoryBlockstore()
    const cidA = await createTestCID('value-a')
    const name = await Name.create()

    const init = await Revision.v0Put(blocks, 'key-a', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const result = await Revision.del(blocks, value, 'key-a')
    assert(result.revision)
    const op = /** @type {API.DeleteOperation & { root: API.ShardLink }} */ (
      result.revision.operation
    )
    assert.equal(op.type, 'del')
    assert.equal(op.key, 'key-a')

    // verify key is gone
    await storeBlocks(blocks, result.additions)
    const value2 = Value.create(name, result.revision.operation.root, [
      result.revision,
    ])
    const got = await Revision.get(blocks, value2, 'key-a')
    assert.equal(got, undefined)
  })

  it('should iterate entries', async () => {
    const blocks = new MemoryBlockstore()
    const cidA = await createTestCID('value-a')
    const cidB = await createTestCID('value-b')
    const cidC = await createTestCID('value-c')
    const name = await Name.create()

    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)
    let value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const r1 = await Revision.put(blocks, value, 'b', cidB)
    await storeBlocks(blocks, r1.additions)
    value = Value.create(name, r1.revision.operation.root, [r1.revision])

    const r2 = await Revision.put(blocks, value, 'c', cidC)
    await storeBlocks(blocks, r2.additions)
    value = Value.create(name, r2.revision.operation.root, [r2.revision])

    const result = []
    for await (const [key, val] of Revision.entries(blocks, value)) {
      result.push([key, val.toString()])
    }

    assert.equal(result.length, 3)
    // entries should be ordered
    assert.equal(result[0][0], 'a')
    assert.equal(result[1][0], 'b')
    assert.equal(result[2][0], 'c')
    assert.equal(result[0][1], cidA.toString())
    assert.equal(result[1][1], cidB.toString())
    assert.equal(result[2][1], cidC.toString())
  })

  it('should overwrite existing key', async () => {
    const blocks = new MemoryBlockstore()
    const cidA = await createTestCID('value-a')
    const cidB = await createTestCID('value-b')
    const name = await Name.create()

    const init = await Revision.v0Put(blocks, 'key', cidA)
    await storeBlocks(blocks, init.additions)
    const value = Value.create(name, init.revision.operation.root, [
      init.revision,
    ])

    const result = await Revision.put(blocks, value, 'key', cidB)
    await storeBlocks(blocks, result.additions)
    const value2 = Value.create(name, result.revision.operation.root, [
      result.revision,
    ])

    const got = await Revision.get(blocks, value2, 'key')
    assert(got)
    assert.equal(got.toString(), cidB.toString())
  })

  it('should roundtrip archive/extract', async () => {
    const blocks = new MemoryBlockstore()
    const cid = await createTestCID('roundtrip')
    const result = await Revision.v0Put(blocks, 'key', cid)
    const bytes = await result.revision.archive()
    const extracted = await Revision.extract(bytes)
    assert.equal(
      extracted.event.cid.toString(),
      result.revision.event.cid.toString()
    )
    assert.deepEqual(extracted.event.bytes, result.revision.event.bytes)
  })

  it('should roundtrip format/parse', async () => {
    const blocks = new MemoryBlockstore()
    const cid = await createTestCID('format')
    const result = await Revision.v0Put(blocks, 'key', cid)
    const str = await Revision.format(result.revision)
    const parsed = await Revision.parse(str)
    assert.equal(
      parsed.event.cid.toString(),
      result.revision.event.cid.toString()
    )
    assert.deepEqual(parsed.event.bytes, result.revision.event.bytes)
  })

  it('should create revision from event block', async () => {
    const blocks = new MemoryBlockstore()
    const cid = await createTestCID('from')
    const result = await Revision.v0Put(blocks, 'key', cid)
    const rev = Revision.from(result.revision.event)
    assert.equal(rev.event.cid.toString(), result.revision.event.cid.toString())
  })

  it('should publish and resolve', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const remote = createRemote(id, service)

    const blocks = new MemoryBlockstore()
    const name = await Name.create(fixtures.alice)
    const cid = await createTestCID('publish-test')

    const init = await Revision.v0Put(blocks, 'key', cid)
    await storeBlocks(blocks, init.additions)

    const pub = await Revision.publish(blocks, name, init.revision, {
      remotes: [remote],
    })
    assert(pub.value)
    assert(pub.value.root)
    assert.equal(pub.value.revision.length, 1)

    const res = await Revision.resolve(blocks, name, { remotes: [remote] })
    assert(res.value)
    assert(res.value.root)
    assert.equal(res.value.revision.length, 1)
  })

  it('should publish and resolve multiple revisions', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const remote = createRemote(id, service)

    const blocks = new MemoryBlockstore()
    const name = await Name.create(fixtures.alice)

    const cidA = await createTestCID('multi-a')
    const cidB = await createTestCID('multi-b')

    // initial put
    const init = await Revision.v0Put(blocks, 'a', cidA)
    await storeBlocks(blocks, init.additions)

    const pub0 = await Revision.publish(blocks, name, init.revision, {
      remotes: [remote],
    })
    await storeBlocks(blocks, pub0.additions)

    // put another key
    const r1 = await Revision.put(blocks, pub0.value, 'b', cidB)
    await storeBlocks(blocks, r1.additions)

    const pub1 = await Revision.publish(blocks, name, r1.revision, {
      remotes: [remote],
    })
    assert(pub1.value)
    assert.equal(pub1.value.revision.length, 1)

    // resolve should return latest
    await storeBlocks(blocks, pub1.additions)
    const res = await Revision.resolve(blocks, name, { remotes: [remote] })
    assert(res.value)
    assert.equal(res.value.revision.length, 1)
  })

  it('should allow delegated publish and resolve', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const remote = createRemote(id, service)

    const blocks = new MemoryBlockstore()
    const name0 = await Name.create(fixtures.alice)

    const cid = await createTestCID('delegated')
    const init = await Revision.v0Put(blocks, 'key', cid)
    await storeBlocks(blocks, init.additions)

    await Revision.publish(blocks, name0, init.revision, {
      remotes: [remote],
    })

    // grant bob access
    const proof = await Name.grant(name0, fixtures.bob.did())
    const name1 = Name.from(fixtures.bob, [proof])

    const res = await Revision.resolve(blocks, name1, { remotes: [remote] })
    assert(res.value)
    assert.equal(res.value.revision.length, 1)
  })

  it('should disallow publish for read only delegation', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const remote = createRemote(id, service)

    const blocks = new MemoryBlockstore()
    const name0 = await Name.create(fixtures.alice)

    const cid = await createTestCID('readonly')
    const init = await Revision.v0Put(blocks, 'key', cid)
    await storeBlocks(blocks, init.additions)

    await Revision.publish(blocks, name0, init.revision, {
      remotes: [remote],
    })

    // grant bob read-only
    const proof = await Name.grant(name0, fixtures.bob.did(), {
      readOnly: true,
    })
    const name1 = Name.from(fixtures.bob, [proof])

    // bob can resolve
    const res = await Revision.resolve(blocks, name1, { remotes: [remote] })
    assert(res.value)

    // bob cannot publish
    const cid2 = await createTestCID('should-fail')
    const r1 = await Revision.put(blocks, res.value, 'key2', cid2)

    await expect(
      Revision.publish(blocks, name1, r1.revision, { remotes: [remote] })
    ).rejects.toThrow(/Claim {"can":"clock\/advance"} is not authorized/)
  })

  it('should throw when resolving but no value is published', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const remote = createRemote(id, service)

    const blocks = new MemoryBlockstore()
    const name = await Name.create(fixtures.alice)

    await expect(
      Revision.resolve(blocks, name, { remotes: [remote] })
    ).rejects.toThrow(/no value/)
  })

  it('should return additions and removals in results', async () => {
    const blocks = new MemoryBlockstore()
    const cid = await createTestCID('diff-test')
    const result = await Revision.v0Put(blocks, 'key', cid)
    assert(Array.isArray(result.additions))
    assert(Array.isArray(result.removals))
    // initial put should have additions (at least the empty shard + new shard)
    assert(result.additions.length > 0)
  })
})
