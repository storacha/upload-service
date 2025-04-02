import retry from 'p-retry'
import defer from 'p-defer'
import LRU from 'hashlru'
import { sha256 } from 'multiformats/hashes/sha2'
import { equals } from 'multiformats/bytes'

/**
 * @import * as API from './api.js'
 */

export class MemoryBlockstore {
  /** @param {Array<API.Block>} [blocks] */
  constructor (blocks = []) {
    /** @type {{ get: (k: string) => Uint8Array | undefined, set: (k: string, v: Uint8Array) => void }} */
    this._data = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
  }

  /** @type { API.BlockFetcher['get']} */
  async get (cid) {
    const bytes = this._data.get(cid.toString())
    if (!bytes) return
    return { cid, bytes }
  }

  /** @param {API.Block} block */
  async put (block) {
    this._data.set(block.cid.toString(), block.bytes)
  }
}

export class LRUBlockstore extends MemoryBlockstore {
  /** @param {number} [max] */
  constructor (max = 50) {
    super()
    // @ts-expect-error
    this._data = LRU(max)
  }
}

const defaultCache = new LRUBlockstore()

/**
 * @param {API.BlockFetcher} fetcher
 * @param {API.BlockFetcher & API.BlockPutter} [cache]
 */
export function withCache (fetcher, cache) {
  cache = cache ?? defaultCache
  return {
    /** @type {API.BlockFetcher['get']} */
    async get (cid) {
      try {
        const block = await cache.get(cid)
        if (block) return block
      } catch {}
      const block = await fetcher.get(cid)
      if (block) {
        // @ts-expect-error
        await cache.put(block)
      }
      return block
    }
  }
}

export class GatewayBlockFetcher {
  #url

  /** @param {string|URL} [url] */
  constructor (url) {
    this.#url = new URL(url ?? 'https://storacha.link')
  }

  /** @type {API.BlockFetcher['get']} */
  async get (cid) {
    return await retry(async () => {
      const controller = new AbortController()
      const timeoutID = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch(new URL(`/ipfs/${cid}?format=raw`, this.#url), { signal: controller.signal })
        if (!res.ok) return
        const bytes = new Uint8Array(await res.arrayBuffer())
        const digest = await sha256.digest(bytes)
        if (!equals(digest.digest, cid.multihash.digest)) {
          throw new Error(`failed sha2-256 content integrity check: ${cid}`)
        }
        return { cid, bytes }
      } catch (err) {
        throw new Error(`failed to fetch block: ${cid}`, { cause: err })
      } finally {
        clearTimeout(timeoutID)
      }
    })
  }
}

/** @param {API.BlockFetcher} fetcher */
export function withInFlight (fetcher) {
  const inflight = new Map()
  return {
    /** @type {API.BlockFetcher['get']} */
    async get (cid) {
      const promise = inflight.get(cid.toString())
      if (promise) return promise
      const deferred = defer()
      inflight.set(cid.toString(), deferred.promise)
      try {
        const block = await fetcher.get(cid)
        inflight.delete(cid.toString())
        deferred.resolve(block)
        return block
      } catch (err) {
        inflight.delete(cid.toString())
        deferred.reject(err)
        throw err
      }
    }
  }
}

export class TieredBlockFetcher {
  /** @type {API.BlockFetcher[]} */
  #fetchers

  /** @param {API.BlockFetcher[]} fetchers */
  constructor (...fetchers) {
    this.#fetchers = fetchers
  }

  /** @type {API.BlockFetcher['get']} */
  async get (link) {
    for (const f of this.#fetchers) {
      const v = await f.get(link)
      if (v) return v
    }
  }
}
