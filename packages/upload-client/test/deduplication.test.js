import assert from 'assert'
import { BlockDeduplicationStream, dedupe } from '../src/deduplication.js'
import { toBlock } from './helpers/block.js'
import * as Stream from './helpers/stream.js'

describe('BlockDeduplicationStream', () => {
  it('deduplicates repeated blocks', async () => {
    const b0 = await toBlock(new Uint8Array([1, 2, 3]))
    const b1 = await toBlock(new Uint8Array([4, 5, 6]))
    const input = [b0, b0, b1, b0, b0, b1, b1, b1]
    const stream = Stream.from(input).pipeThrough(
      new BlockDeduplicationStream()
    )
    const output = await Stream.collect(stream)
    assert.equal(output.length, 2)
    assert(output.some((b) => b.cid.toString() === b0.cid.toString()))
    assert(output.some((b) => b.cid.toString() === b1.cid.toString()))
  })
})

describe('dedupe', () => {
  it('deduplicates repeated blocks', async () => {
    const b0 = await toBlock(new Uint8Array([1, 2, 3]))
    const b1 = await toBlock(new Uint8Array([4, 5, 6]))
    const input = [b0, b0, b1, b0, b0, b1, b1, b1]
    const output = [...dedupe(input)]
    assert.equal(output.length, 2)
    assert(output.some((b) => b.cid.toString() === b0.cid.toString()))
    assert(output.some((b) => b.cid.toString() === b1.cid.toString()))
  })
})
