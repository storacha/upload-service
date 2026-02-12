import { describe, it, assert, expect } from 'vitest'
import * as CAR from '@ucanto/transport/car'
import { connect } from '@ucanto/client'
import * as Name from '../../src/base/name.js'
import * as Revision from '../../src/base/revision.js'
import * as State from '../../src/base/state.js'
import { NoValueError } from '../../src/base/revision.js'
import { createServer, createService } from '../../src/server/index.js'
import { MemoryBlockstore } from '../../src/base/block.js'
import { MemoryHeadStorage, fixtures } from '../helpers.js'

describe('base/revision', () => {
  it('should create initial revision with v0', async () => {
    const rev = await Revision.v0('test-value')
    assert.equal(rev.value, 'test-value')
    assert.equal(rev.operation, 'test-value')
    assert.equal(rev.event.value.data, 'test-value')
    assert.equal(rev.event.value.parents.length, 0)
  })

  it('should roundtrip archive/extract', async () => {
    const rev = await Revision.v0('round-trip')
    const bytes = await rev.archive()
    const extracted = await Revision.extract(bytes)
    assert.equal(extracted.value, rev.value)
    assert.equal(extracted.event.cid.toString(), rev.event.cid.toString())
    assert.deepEqual(extracted.event.bytes, rev.event.bytes)
  })

  it('should roundtrip format/parse', async () => {
    const rev = await Revision.v0('format-parse')
    const str = await Revision.format(rev)
    const parsed = await Revision.parse(str)
    assert.equal(parsed.value, rev.value)
    assert.equal(parsed.event.cid.toString(), rev.event.cid.toString())
    assert.deepEqual(parsed.event.bytes, rev.event.bytes)
  })

  it('should create revision from event block', async () => {
    const rev = await Revision.v0('from-event')
    const rev2 = Revision.from(rev.event)
    assert.equal(rev2.value, 'from-event')
    assert.equal(rev2.event.cid.toString(), rev.event.cid.toString())
  })

  it('should increment revision', async () => {
    const name = await Name.create()
    const rev0 = await Revision.v0('v0')
    const state = State.create(name, [rev0])
    const rev1 = await Revision.increment(state, 'v1')
    assert.equal(rev1.value, 'v1')
    assert.equal(rev1.event.value.parents.length, 1)
    assert.equal(
      rev1.event.value.parents[0].toString(),
      rev0.event.cid.toString()
    )
  })

  it('should increment revision with multiple parents', async () => {
    const name = await Name.create()
    const rev0 = await Revision.v0('v0')
    const rev1 = await Revision.v0('v1')
    const state = State.create(name, [rev0, rev1])
    const rev2 = await Revision.increment(state, 'v2')
    assert.equal(rev2.value, 'v2')
    assert.equal(rev2.event.value.parents.length, 2)
    assert(
      rev2.event.value.parents.some(
        (p) => p.toString() === rev0.event.cid.toString()
      )
    )
    assert(
      rev2.event.value.parents.some(
        (p) => p.toString() === rev1.event.cid.toString()
      )
    )
  })

  it('should export revision blocks', async () => {
    const rev = await Revision.v0('export-test')
    const blocks = []
    for await (const block of rev.export()) {
      blocks.push(block)
    }
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].cid.toString(), rev.event.cid.toString())
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
    assert.equal(pub0.revision.length, 1)
    assert.equal(pub0.revision[0].value, fixtures.values[0])

    const res0 = await Revision.resolve(name, { remotes: [remote] })
    assert.equal(res0.revision.length, 1)
    assert.equal(res0.revision[0].value, fixtures.values[0])
  })

  it('should throw NoValueError when resolving unpublished name', async () => {
    const service = createService({
      headStore: new MemoryHeadStorage(),
      blockFetcher: { get: async () => undefined },
      blockCache: new MemoryBlockstore(),
    })

    const id = fixtures.service
    const server = createServer(id, service)
    const remote = connect({ id, codec: CAR.outbound, channel: server })
    const name = await Name.create(fixtures.alice)

    await expect(Revision.resolve(name, { remotes: [remote] })).rejects.toThrow(
      /no value/
    )
  })

  it('NoValueError should have correct code', () => {
    const err = new NoValueError('test')
    assert.equal(err.code, 'ERR_NO_VALUE')
    assert.equal(NoValueError.code, 'ERR_NO_VALUE')
  })
})
