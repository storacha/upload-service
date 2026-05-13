import { describe, expect, it } from 'vitest'
import { base58btc } from 'multiformats/bases/base58'

import { findCarparkLocation } from '../src/reader/carpark.js'
import { createTestCID, createMockFallbackFetch } from './helpers.js'

/**
 * @import * as API from '../src/api.js'
 */

/**
 * @param {API.UnknownLink} shardCid
 * @returns {API.ShardEntry}
 */
function createShardEntry(shardCid) {
  return {
    cidStr: shardCid.toString(),
    multihash: shardCid.multihash,
    b58: base58btc.encode(shardCid.multihash.bytes),
  }
}

describe('findCarparkLocation', () => {
  it('finds the cid/cid.car object on the first host', async () => {
    const shardCid = await createTestCID('carpark-cid-path')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: 1024 }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 1024n,
    })
  })

  it('falls back to the multihash blob path on the same host', async () => {
    const shardCid = await createTestCID('carpark-blob-path')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.b58}/${shard.b58}.blob`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: '2048' }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 2048n,
    })
  })

  it('tries the second host when the first host misses', async () => {
    const shardCid = await createTestCID('carpark-second-host')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-1.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: 4096 }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 4096n,
    })
  })

  it('returns the first successful candidate that resolves in the full parallel race', async () => {
    const shardCid = await createTestCID('carpark-race-winner')
    const shard = createShardEntry(shardCid)
    const slowUrl = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fastUrl = `https://carpark-prod-1.r2.w3s.link/${shard.b58}/${shard.b58}.blob`

    const fetcher = /** @type {typeof fetch} */ (
      async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        if ((init?.method ?? 'GET').toUpperCase() !== 'HEAD') {
          throw new Error(`Unexpected method for ${url}`)
        }

        if (url === slowUrl) {
          await new Promise((resolve) => setTimeout(resolve, 20))
          return /** @type {Response} */ (
            /** @type {unknown} */ ({
              ok: true,
              status: 200,
              headers: { get: () => '1024' },
            })
          )
        }

        if (url === fastUrl) {
          await new Promise((resolve) => setTimeout(resolve, 0))
          return /** @type {Response} */ (
            /** @type {unknown} */ ({
              ok: true,
              status: 200,
              headers: { get: () => '2048' },
            })
          )
        }

        return /** @type {Response} */ (
          /** @type {unknown} */ ({
            ok: false,
            status: 404,
            headers: { get: () => null },
          })
        )
      }
    )

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: fastUrl,
      size: 2048n,
    })
  })

  it('aborts sibling probes after one candidate wins the race', async () => {
    const shardCid = await createTestCID('carpark-sibling-abort')
    const shard = createShardEntry(shardCid)
    const winnerUrl = `https://carpark-prod-1.r2.w3s.link/${shard.b58}/${shard.b58}.blob`

    /** @type {Array<{ url: string, signal: AbortSignal | null | undefined }>} */
    const probes = []
    const fetcher = /** @type {typeof fetch} */ (
      async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        probes.push({ url, signal: init?.signal })

        if (url === winnerUrl) {
          return /** @type {Response} */ (
            /** @type {unknown} */ ({
              ok: true,
              status: 200,
              headers: { get: () => '256' },
            })
          )
        }

        return await new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () =>
              reject(
                new DOMException('The operation was aborted.', 'AbortError')
              ),
            { once: true }
          )
        })
      }
    )

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: winnerUrl,
      size: 256n,
    })
    expect(probes).toHaveLength(4)
    expect(
      probes
        .filter((probe) => probe.url !== winnerUrl)
        .every((probe) => probe.signal?.aborted === true)
    ).toBe(true)
    expect(
      probes.find((probe) => probe.url === winnerUrl)?.signal?.aborted ?? false
    ).toBe(false)
  })

  it('returns 0n when the object exists but Content-Length is missing', async () => {
    const shardCid = await createTestCID('carpark-no-content-length')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, {}]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 0n,
    })
  })

  it('returns 0n when Content-Length is malformed', async () => {
    const shardCid = await createTestCID('carpark-bad-content-length')
    const shard = createShardEntry(shardCid)
    const url = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[url, { contentLength: 'not-a-number' }]]),
    })

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: url,
      size: 0n,
    })
  })

  it('returns null when every candidate misses', async () => {
    const shardCid = await createTestCID('carpark-miss')
    const shard = createShardEntry(shardCid)
    const fetcher = createMockFallbackFetch()

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toBeNull()
  })

  it('ignores non-abort probe failures and still returns a later success', async () => {
    const shardCid = await createTestCID('carpark-throws-then-succeeds')
    const shard = createShardEntry(shardCid)
    const successUrl = `https://carpark-prod-1.r2.w3s.link/${shard.b58}/${shard.b58}.blob`

    const fetcher = /** @type {typeof fetch} */ (
      async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        if ((init?.method ?? 'GET').toUpperCase() !== 'HEAD') {
          throw new Error(`Unexpected method for ${url}`)
        }

        if (url.includes('carpark-prod-0')) {
          throw new Error('transient head failure')
        }

        if (url === successUrl) {
          return /** @type {Response} */ (
            /** @type {unknown} */ ({
              ok: true,
              status: 200,
              headers: { get: () => '512' },
            })
          )
        }

        return /** @type {Response} */ (
          /** @type {unknown} */ ({
            ok: false,
            status: 404,
            headers: { get: () => null },
          })
        )
      }
    )

    const match = await findCarparkLocation(shard, fetcher)

    expect(match).toEqual({
      locationURL: successUrl,
      size: 512n,
    })
  })

  it('propagates abort through concurrent candidate probes', async () => {
    const shardCid = await createTestCID('carpark-abort')
    const shard = createShardEntry(shardCid)
    const ac = new AbortController()

    const fetcher = /** @type {typeof fetch} */ (
      async (_input, init) => {
        return await new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
            return
          }

          init?.signal?.addEventListener(
            'abort',
            () =>
              reject(
                new DOMException('The operation was aborted.', 'AbortError')
              ),
            { once: true }
          )
        })
      }
    )

    const run = findCarparkLocation(shard, fetcher, ac.signal)
    ac.abort()

    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
  })
})
