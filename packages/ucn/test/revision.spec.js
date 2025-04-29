import { describe, it, assert, expect } from 'vitest'
import * as CAR from '@ucanto/transport/car'
import { connect } from '@ucanto/client'
import * as Name from '../src/name.js'
import * as Revision from '../src/revision.js'
import * as Value from '../src/value.js'
import { createServer, createService } from '../src/server/index.js'
import { MemoryBlockstore } from '../src/block.js'
import { MemoryHeadStorage, fixtures } from './helpers.js'

describe('revision', () => {
  it('should roundtrip archive/extract', async () => {
    const rev = await Revision.v0(fixtures.values[0])
    const bytes = await rev.archive()
    const extracted = await Revision.extract(bytes)
    assert.equal(extracted.value, rev.value)
    assert.equal(extracted.event.cid.toString(), rev.event.cid.toString())
    assert.deepEqual(extracted.event.bytes, rev.event.bytes)
  })

  it('should roundtrip format/parse', async () => {
    const rev = await Revision.v0(fixtures.values[0])
    const str = await Revision.format(rev)
    const parsed = await Revision.parse(str)
    assert.equal(parsed.value, rev.value)
    assert.equal(parsed.event.cid.toString(), rev.event.cid.toString())
    assert.deepEqual(parsed.event.bytes, rev.event.bytes)
  })

  it('should increment revision', async () => {
    const name = await Name.create()
    const rev0 = await Revision.v0(fixtures.values[0])
    const rev1 = await Revision.increment(
      Value.from(name, rev0),
      fixtures.values[1]
    )
    assert.equal(rev1.value, fixtures.values[1])
    assert.equal(rev1.event.value.data, fixtures.values[1])
    assert.equal(rev1.event.value.parents.length, 1)
    assert.equal(
      rev1.event.value.parents[0].toString(),
      rev0.event.cid.toString()
    )
  })

  it('should increment revision multi parent', async () => {
    const name = await Name.create()
    const rev0 = await Revision.v0(fixtures.values[0])

    const cur0 = Value.from(name, rev0)

    // create two conflicting revisions from the same value
    const rev1 = await Revision.increment(cur0, fixtures.values[1])
    const rev2 = await Revision.increment(cur0, fixtures.values[2])

    // create a third revision from the 2 conflicting revisions
    const rev3 = await Revision.increment(
      Value.from(name, rev1, rev2),
      fixtures.values[3]
    )

    assert.equal(rev3.value, fixtures.values[3])
    assert.equal(rev3.event.value.data, fixtures.values[3])
    assert.equal(rev3.event.value.parents.length, 2)
    assert(
      rev3.event.value.parents.some(
        (p) => p.toString() === rev1.event.cid.toString()
      )
    )
    assert(
      rev3.event.value.parents.some(
        (p) => p.toString() === rev2.event.cid.toString()
      )
    )
  })

  it('should publish and resolve', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })

    const name = await Name.create(fixtures.alice)
    const rev0 = await Revision.v0(fixtures.values[0])

    const pub0 = await Revision.publish(name, rev0, { remotes: [remote] })
    assert.equal(pub0.value, fixtures.values[0])

    const res0 = await Revision.resolve(name, { remotes: [remote] })
    assert.equal(res0.value, fixtures.values[0])
  })

  it('should publish and resolve multiple revisions', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })

    const name = await Name.create(fixtures.alice)
    const rev0 = await Revision.v0(fixtures.values[0])

    let prev = Value.from(name, rev0)
    for (const value of fixtures.values.slice(1)) {
      const rev = await Revision.increment(prev, value)
      const pub = await Revision.publish(name, rev, { remotes: [remote] })
      assert.equal(pub.value, value)
      const res = await Revision.resolve(name, { remotes: [remote] })
      assert.equal(res.value, value)
      prev = res
    }
  })

  it('should allow skipped revision publish', async () => {
    /** @type {Record<string, any>} */
    const blocks = {}
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async (cid) => blocks[cid.toString()] },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })

    const name = await Name.create(fixtures.alice)
    const rev0 = await Revision.v0(fixtures.values[0])

    await Revision.publish(name, rev0, { remotes: [remote] })

    const rev1 = await Revision.increment(
      Value.from(name, rev0),
      fixtures.values[1]
    )
    const rev2 = await Revision.increment(
      Value.from(name, rev1),
      fixtures.values[2]
    )

    // make the skipped revision block available
    for await (const block of rev1.export()) {
      blocks[block.cid.toString()] = block
    }

    const pub1 = await Revision.publish(name, rev2, { remotes: [remote] })
    assert.equal(pub1.value, fixtures.values[2])

    const res0 = await Revision.resolve(name, { remotes: [remote] })
    assert.equal(res0.value, fixtures.values[2])
  })

  it('should allow delegated publish and resolve', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })

    const name0 = await Name.create(fixtures.alice)
    const rev0 = await Revision.v0(fixtures.values[0])

    await Revision.publish(name0, rev0, { remotes: [remote] })

    const proof = await Name.grant(name0, fixtures.bob.did())
    const name1 = Name.from(fixtures.bob, [proof])

    const res0 = await Revision.resolve(name1, { remotes: [remote] })
    assert.equal(res0.value, fixtures.values[0])

    const rev1 = await Revision.increment(res0, fixtures.values[1])
    const pub1 = await Revision.publish(name1, rev1, { remotes: [remote] })
    assert.equal(pub1.value, fixtures.values[1])
  })

  it('should disallow publish for read only delegation', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })

    const name0 = await Name.create(fixtures.alice)
    const rev0 = await Revision.v0(fixtures.values[0])

    await Revision.publish(name0, rev0, { remotes: [remote] })

    const proof = await Name.grant(name0, fixtures.bob.did(), {
      readOnly: true,
    })
    const name1 = Name.from(fixtures.bob, [proof])

    const res0 = await Revision.resolve(name1, { remotes: [remote] })
    const rev1 = await Revision.increment(res0, fixtures.values[1])

    await expect(
      Revision.publish(name1, rev1, { remotes: [remote] })
    ).rejects.toThrow(/Claim {"can":"clock\/advance"} is not authorized/)
  })

  it('should allow conflicts', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })

    const name0 = await Name.create(fixtures.alice)
    const rev0 = await Revision.v0(fixtures.values[0])

    const pub0 = await Revision.publish(name0, rev0, { remotes: [remote] })
    assert.equal(pub0.value, fixtures.values[0])

    const proof = await Name.grant(name0, fixtures.bob.did())
    const name1 = Name.from(fixtures.bob, [proof])

    // bob publishes on top of rev0
    const res0 = await Revision.resolve(name1, { remotes: [remote] })
    const rev1 = await Revision.increment(res0, fixtures.values[1])
    await Revision.publish(name1, rev1, { remotes: [remote] })

    // alice also publishes on top of rev0
    const rev2 = await Revision.increment(
      Value.from(name0, rev0),
      fixtures.values[2]
    )
    await Revision.publish(name0, rev2, { remotes: [remote] })

    const res1 = await Revision.resolve(name1, { remotes: [remote] })
    assert.equal(res1.revision.length, 2)

    // now bob publishes on top of conflicted version
    const rev3 = await Revision.increment(res1, fixtures.values[3])
    await Revision.publish(name1, rev3, { remotes: [remote] })

    const res2 = await Revision.resolve(name1, { remotes: [remote] })
    assert.equal(res2.revision.length, 1)
    assert.equal(res2.value, fixtures.values[3])
  })

  it.skip('should publish to multiple remotes')
})
