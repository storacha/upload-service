import { describe, it, assert } from 'vitest'
import { sha256 } from 'multiformats/hashes/sha2'
import { CID } from 'multiformats/cid'
import {
  MemoryBlockstore,
  LRUBlockstore,
  withCache,
  TieredBlockFetcher,
  withInFlight,
} from '../../src/base/block.js'

/** @import { BlockFetcher } from '../../src/base/api.js' */

/**
 * @param {string} s
 */
const createBlock = async (s) => {
  const bytes = new TextEncoder().encode(s)
  const hash = await sha256.digest(bytes)
  const cid = CID.create(1, 0x55, hash)
  return { cid, bytes }
}

describe('MemoryBlockstore', () => {
  it('should put and get a block', async () => {
    const store = new MemoryBlockstore()
    const block = await createBlock('hello')
    await store.put(block)
    const got = await store.get(block.cid)
    assert(got)
    assert.equal(got.cid.toString(), block.cid.toString())
    assert.deepEqual(got.bytes, block.bytes)
  })

  it('should return undefined for missing block', async () => {
    const store = new MemoryBlockstore()
    const block = await createBlock('missing')
    const got = await store.get(block.cid)
    assert.equal(got, undefined)
  })

  it('should initialize with blocks', async () => {
    const block = await createBlock('init')
    const store = new MemoryBlockstore([block])
    const got = await store.get(block.cid)
    assert(got)
    assert.deepEqual(got.bytes, block.bytes)
  })

  it('should store multiple blocks', async () => {
    const store = new MemoryBlockstore()
    const b1 = await createBlock('one')
    const b2 = await createBlock('two')
    const b3 = await createBlock('three')
    await store.put(b1)
    await store.put(b2)
    await store.put(b3)
    assert(await store.get(b1.cid))
    assert(await store.get(b2.cid))
    assert(await store.get(b3.cid))
  })
})

describe('LRUBlockstore', () => {
  it('should put and get a block', async () => {
    const store = new LRUBlockstore()
    const block = await createBlock('hello')
    await store.put(block)
    const got = await store.get(block.cid)
    assert(got)
    assert.deepEqual(got.bytes, block.bytes)
  })
})

describe('withCache', () => {
  it('should cache fetched blocks', async () => {
    const block = await createBlock('cached')
    const source = new MemoryBlockstore([block])
    let fetchCount = 0
    /** @type {BlockFetcher} */
    const fetcher = {
      /**
       * @type {BlockFetcher['get']}
       */
      async get(cid) {
        fetchCount++
        return source.get(cid)
      },
    }
    const cache = new MemoryBlockstore()
    const cached = withCache(fetcher, cache)
    const got1 = await cached.get(block.cid)
    assert(got1)
    assert.equal(fetchCount, 1)
    const got2 = await cached.get(block.cid)
    assert(got2)
    assert.equal(fetchCount, 1) // served from cache
  })

  it('should return undefined for missing block', async () => {
    const block = await createBlock('nope')
    /** @type {BlockFetcher} */
    const fetcher = {
      async get() {
        return undefined
      },
    }
    const cache = new MemoryBlockstore()
    const cached = withCache(fetcher, cache)
    const got = await cached.get(block.cid)
    assert.equal(got, undefined)
  })
})

describe('TieredBlockFetcher', () => {
  it('should return block from first fetcher that has it', async () => {
    const block = await createBlock('tiered')
    /** @type {BlockFetcher} */
    const f1 = {
      async get() {
        return undefined
      },
    }
    const f2 = new MemoryBlockstore([block])
    const tiered = new TieredBlockFetcher(f1, f2)
    const got = await tiered.get(block.cid)
    assert(got)
    assert.deepEqual(got.bytes, block.bytes)
  })

  it('should prefer earlier fetcher', async () => {
    const b1 = await createBlock('first')
    const source = new MemoryBlockstore([b1])
    let f1FetchCount = 0
    let f2FetchCount = 0
    /** @type {BlockFetcher} */
    const f1 = {
      async get(cid) {
        f1FetchCount++
        return source.get(cid)
      },
    }
    /** @type {BlockFetcher} */
    const f2 = {
      async get(cid) {
        f2FetchCount++
        return source.get(cid)
      },
    }
    const tiered = new TieredBlockFetcher(f1, f2)
    const got = await tiered.get(b1.cid)
    assert(got)
    assert.equal(f1FetchCount, 1)
    assert.equal(f2FetchCount, 0) // f2 not called since f1 had the block
  })

  it('should return undefined when no fetcher has the block', async () => {
    const block = await createBlock('missing')
    /** @type {BlockFetcher} */
    const f1 = {
      async get() {
        return undefined
      },
    }
    /** @type {BlockFetcher} */
    const f2 = {
      async get() {
        return undefined
      },
    }
    const tiered = new TieredBlockFetcher(f1, f2)
    const got = await tiered.get(block.cid)
    assert.equal(got, undefined)
  })
})

describe('withInFlight', () => {
  it('should deduplicate concurrent requests', async () => {
    const block = await createBlock('inflight')
    const source = new MemoryBlockstore([block])
    let fetchCount = 0
    /** @type {BlockFetcher} */
    const fetcher = {
      async get(cid) {
        fetchCount++
        // simulate async delay
        await new Promise((r) => setTimeout(r, 10))
        return source.get(cid)
      },
    }
    const deduped = withInFlight(fetcher)
    const [got1, got2] = await Promise.all([
      deduped.get(block.cid),
      deduped.get(block.cid),
    ])
    assert(got1)
    assert(got2)
    assert.equal(fetchCount, 1)
  })

  it('should allow sequential requests', async () => {
    const block = await createBlock('sequential')
    const source = new MemoryBlockstore([block])
    let fetchCount = 0
    /** @type {BlockFetcher} */
    const fetcher = {
      async get(cid) {
        fetchCount++
        return source.get(cid)
      },
    }
    const deduped = withInFlight(fetcher)
    await deduped.get(block.cid)
    await deduped.get(block.cid)
    assert.equal(fetchCount, 2) // separate requests, not deduped
  })
})
