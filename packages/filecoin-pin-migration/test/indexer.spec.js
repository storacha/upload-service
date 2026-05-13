import { afterEach, describe, expect, it, vi } from 'vitest'
import { base58btc } from 'multiformats/bases/base58'

import { MAX_QUERY_CLAIMS_HASHES_PER_REQUEST } from '../src/constants.js'
import { resolveClaimsIndex } from '../src/reader/indexer.js'
import {
  createPieceCID,
  createTestCID,
  createMockFetch,
  createMockFallbackFetch,
  createMockIndexer,
  buildCIDContactProviderAddr,
  buildEqualsClaimMetadata,
  buildExpectedCIDContactURL,
  buildIPNIFindResponse,
  buildLocationCommitmentMetadata,
} from './helpers.js'

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

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('resolveClaimsIndex', () => {
  it('prefers full multihash bytes over digest-only content.digest when merging primary claims', async () => {
    const shardCid = await createTestCID('shard-primary-keying')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)

    const claims = new Map([
      [
        'location-claim',
        {
          type: /** @type {const} */ ('assert/location'),
          content: {
            digest: shardCid.multihash.digest,
            multihash: shardCid.multihash,
          },
          location: [new URL('https://r2.example/shard-primary-keying')],
        },
      ],
      [
        'equals-claim',
        {
          type: /** @type {const} */ ('assert/equals'),
          content: {
            digest: shardCid.multihash.digest,
            multihash: shardCid.multihash,
          },
          equals: pieceCid,
        },
      ],
    ])
    const indexer = createMockIndexer(new Map([[shard.b58, { claims }]]))

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher: undefined,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe('https://r2.example/shard-primary-keying')
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
  })

  it('repairs missing location URL from cid.contact', async () => {
    const shardCid = await createTestCID('shard-ipni-location')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const locationHost = 'carpark.example'

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'equals-claim',
                {
                  type: /** @type {const} */ ('assert/equals'),
                  content: { multihash: shardCid.multihash },
                  equals: pieceCid,
                },
              ],
            ]),
          },
        ],
      ])
    )
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 2048n }),
              Provider: {
                Addrs: [buildCIDContactProviderAddr(locationHost)],
              },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(
      buildExpectedCIDContactURL(shardCid, locationHost)
    )
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(2048n)
  })

  it('repairs missing pieceCID from cid.contact', async () => {
    const shardCid = await createTestCID('shard-ipni-piece')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'location-claim',
                {
                  type: /** @type {const} */ ('assert/location'),
                  content: { multihash: shardCid.multihash },
                  location: [new URL('https://r2.example/shard-ipni-piece')],
                },
              ],
            ]),
          },
        ],
      ])
    )
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildEqualsClaimMetadata(pieceCid),
              Provider: { Addrs: [] },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe('https://r2.example/shard-ipni-piece')
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
  })

  it('falls back to cid.contact when the primary claim query fails entirely', async () => {
    const shardCid = await createTestCID('shard-ipni-total-failure')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const locationHost = 'fallback.example'

    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims() {
        throw new Error('indexer unavailable')
      },
    })
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 4096n }),
              Provider: {
                Addrs: [buildCIDContactProviderAddr(locationHost)],
              },
            },
            {
              Metadata: buildEqualsClaimMetadata(pieceCid),
              Provider: { Addrs: [] },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(
      buildExpectedCIDContactURL(shardCid, locationHost)
    )
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(4096n)
  })

  it('expands {blob} using multibase-prefixed base32upper in cid.contact paths', async () => {
    const shardCid = await createTestCID('shard-ipni-blob-template')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const locationHost = 'carpark-template.example'

    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims() {
        throw new Error('indexer unavailable')
      },
    })
    const fetcher = createMockFetch(
      new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 1024n }),
              Provider: {
                Addrs: [buildCIDContactProviderAddr(locationHost)],
              },
            },
            {
              Metadata: buildEqualsClaimMetadata(pieceCid),
              Provider: { Addrs: [] },
            },
          ]),
        ],
      ])
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(
      buildExpectedCIDContactURL(shardCid, locationHost)
    )
    expect(entry?.locationURL).toContain('/B')
  })

  it('repairs missing location URL from the public carpark buckets when claims and cid.contact both miss', async () => {
    const shardCid = await createTestCID('shard-carpark-location')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const carUrl = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'equals-claim',
                {
                  type: /** @type {const} */ ('assert/equals'),
                  content: { multihash: shardCid.multihash },
                  equals: pieceCid,
                },
              ],
            ]),
          },
        ],
      ])
    )
    const fetcher = createMockFallbackFetch({
      headResponses: new Map([[carUrl, { contentLength: 8192 }]]),
    })

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(carUrl)
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(8192n)
  })

  it('uses the carpark location fallback without overwriting an existing size', async () => {
    const shardCid = await createTestCID('shard-carpark-preserve-size')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const carUrl = `https://carpark-prod-1.r2.w3s.link/${shard.b58}/${shard.b58}.blob`

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'equals-claim',
                {
                  type: /** @type {const} */ ('assert/equals'),
                  content: { multihash: shardCid.multihash },
                  equals: pieceCid,
                },
              ],
            ]),
          },
        ],
      ])
    )
    const fetcher = createMockFallbackFetch({
      cidContactResponses: new Map([
        [
          shard.b58,
          buildIPNIFindResponse([
            {
              Metadata: buildLocationCommitmentMetadata({ size: 2048n }),
              Provider: { Addrs: ['/dns4/example.invalid/tcp/443/https'] },
            },
          ]),
        ],
      ]),
      headResponses: new Map([[carUrl, { contentLength: 9999 }]]),
    })

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(carUrl)
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(2048n)
  })

  it('falls through to carpark when cid.contact times out', async () => {
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController()
      setTimeout(
        () =>
          controller.abort(
            new DOMException('The operation timed out.', 'TimeoutError')
          ),
        1
      )
      return controller.signal
    })

    const shardCid = await createTestCID('shard-ipni-timeout')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const carUrl = `https://carpark-prod-0.r2.w3s.link/${shard.cidStr}/${shard.cidStr}.car`

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'equals-claim',
                {
                  type: /** @type {const} */ ('assert/equals'),
                  content: { multihash: shardCid.multihash },
                  equals: pieceCid,
                },
              ],
            ]),
          },
        ],
      ])
    )

    let cidContactRequests = 0
    const fetcher = /** @type {typeof fetch} */ (
      (input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        if ((init?.method ?? 'GET').toUpperCase() === 'HEAD') {
          if (url !== carUrl) {
            return Promise.resolve(new Response(null, { status: 404 }))
          }

          return Promise.resolve(
            new Response(null, {
              status: 200,
              headers: { 'content-length': '8192' },
            })
          )
        }

        cidContactRequests += 1
        const signal = init?.signal
        return new Promise((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              reject(
                signal.reason ??
                  new DOMException('The operation was aborted.', 'AbortError')
              )
            },
            { once: true }
          )
        })
      }
    )

    const run = resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
    })

    await vi.advanceTimersByTimeAsync(1)
    const index = await run

    expect(cidContactRequests).toBe(1)
    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(carUrl)
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(8192n)
  })

  it('bypasses cid.contact when skipIPNIFallback is true but still probes carpark', async () => {
    const shardCid = await createTestCID('shard-skip-ipni')
    const pieceCid = createPieceCID()
    const shard = createShardEntry(shardCid)
    const carUrl = `https://carpark-prod-1.r2.w3s.link/${shard.b58}/${shard.b58}.blob`

    const indexer = createMockIndexer(
      new Map([
        [
          shard.b58,
          {
            claims: new Map([
              [
                'equals-claim',
                {
                  type: /** @type {const} */ ('assert/equals'),
                  content: { multihash: shardCid.multihash },
                  equals: pieceCid,
                },
              ],
            ]),
          },
        ],
      ])
    )

    let cidContactRequests = 0
    const fetcher = /** @type {typeof fetch} */ (
      async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        if ((init?.method ?? 'GET').toUpperCase() === 'HEAD') {
          if (url !== carUrl) {
            return new Response(null, { status: 404 })
          }

          return new Response(null, {
            status: 200,
            headers: { 'content-length': '4096' },
          })
        }

        cidContactRequests += 1
        return new Response('{}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      }
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: [shard],
      fetcher,
      skipIPNIFallback: true,
    })

    expect(cidContactRequests).toBe(0)
    const entry = index.get(shard.b58)
    expect(entry).toBeDefined()
    expect(entry?.locationURL).toBe(carUrl)
    expect(entry?.piece?.link.toString()).toBe(pieceCid.toString())
    expect(entry?.size).toBe(4096n)
  })

  it('splits primary queryClaims requests so no batch exceeds the transport safety cap', async () => {
    /** @type {API.ShardEntry[]} */
    const shards = []
    for (
      let index = 0;
      index < MAX_QUERY_CLAIMS_HASHES_PER_REQUEST * 2 + 25;
      index += 1
    ) {
      shards.push(createShardEntry(await createTestCID(`shard-batch-${index}`)))
    }

    /** @type {number[]} */
    const batchSizes = []
    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims({ hashes }) {
        batchSizes.push(hashes.length)
        return {
          ok: {
            claims: new Map(),
            indexes: new Map(),
          },
        }
      },
    })

    await resolveClaimsIndex({
      indexer,
      shards,
      fetcher: undefined,
    })

    expect(batchSizes.length).toBeGreaterThan(2)
    expect(
      batchSizes.every((size) => size <= MAX_QUERY_CLAIMS_HASHES_PER_REQUEST)
    ).toBe(true)
  })

  it('falls back only for hashes left incomplete by failed primary sub-batches', async () => {
    /** @type {API.ShardEntry[]} */
    const firstBatchShards = []
    for (
      let index = 0;
      index < MAX_QUERY_CLAIMS_HASHES_PER_REQUEST;
      index += 1
    ) {
      firstBatchShards.push(
        createShardEntry(await createTestCID(`shard-primary-ok-${index}`))
      )
    }
    const failedShard = createShardEntry(
      await createTestCID('shard-primary-failed')
    )
    const allShards = [...firstBatchShards, failedShard]
    const pieceCid = createPieceCID()

    const primaryClaims = new Map()
    for (const shard of firstBatchShards) {
      primaryClaims.set(`location:${shard.b58}`, {
        type: /** @type {const} */ ('assert/location'),
        content: { multihash: shard.multihash },
        location: [new URL(`https://r2.example/${shard.b58}`)],
      })
      primaryClaims.set(`equals:${shard.b58}`, {
        type: /** @type {const} */ ('assert/equals'),
        content: { multihash: shard.multihash },
        equals: pieceCid,
      })
    }

    let queryCount = 0
    const indexer = /** @type {API.IndexingServiceReader} */ (
      /** @type {unknown} */ ({
        async queryClaims() {
          queryCount += 1
          if (queryCount === 2) {
            throw new Error('transient primary failure')
          }
          return {
            ok: {
              claims: primaryClaims,
              indexes: new Map(),
            },
          }
        },
      })
    )

    /** @type {string[]} */
    const fallbackLookups = []
    const fetcher = /** @type {typeof fetch} */ (
      async (input) => {
        const url = typeof input === 'string' ? input : input.toString()
        const b58 = url.split('/').pop() ?? ''
        fallbackLookups.push(b58)

        return /** @type {Response} */ ({
          ok: true,
          status: 200,
          json: async () =>
            buildIPNIFindResponse([
              {
                Metadata: buildLocationCommitmentMetadata({ size: 4096n }),
                Provider: {
                  Addrs: [buildCIDContactProviderAddr('fallback.example')],
                },
              },
              {
                Metadata: buildEqualsClaimMetadata(pieceCid),
                Provider: { Addrs: [] },
              },
            ]),
        })
      }
    )

    const index = await resolveClaimsIndex({
      indexer,
      shards: allShards,
      fetcher,
    })

    expect(fallbackLookups).toEqual([failedShard.b58.replace(/^z/, '')])
    expect(index.get(firstBatchShards[0].b58)?.locationURL).toBe(
      `https://r2.example/${firstBatchShards[0].b58}`
    )
    expect(index.get(failedShard.b58)?.locationURL).toBe(
      buildExpectedCIDContactURL(
        await createTestCID('shard-primary-failed'),
        'fallback.example'
      )
    )
  })

  it('deduplicates shards before splitting primary queryClaims batches', async () => {
    /** @type {API.ShardEntry[]} */
    const uniqueShards = []
    for (let index = 0; index < 350; index += 1) {
      uniqueShards.push(
        createShardEntry(await createTestCID(`shard-dedup-${index}`))
      )
    }
    const shards = [...uniqueShards, ...uniqueShards.slice(0, 50)]

    /** @type {number[]} */
    const batchSizes = []
    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims({ hashes }) {
        batchSizes.push(hashes.length)
        return {
          ok: {
            claims: new Map(),
            indexes: new Map(),
          },
        }
      },
    })

    await resolveClaimsIndex({
      indexer,
      shards,
      fetcher: undefined,
    })

    expect(batchSizes.reduce((sum, size) => sum + size, 0)).toBe(
      uniqueShards.length
    )
    expect(
      batchSizes.every((size) => size <= MAX_QUERY_CLAIMS_HASHES_PER_REQUEST)
    ).toBe(true)
  })

  it('stops between primary sub-batches when the signal is aborted', async () => {
    /** @type {API.ShardEntry[]} */
    const shards = []
    for (
      let index = 0;
      index < MAX_QUERY_CLAIMS_HASHES_PER_REQUEST * 2;
      index += 1
    ) {
      shards.push(createShardEntry(await createTestCID(`shard-abort-${index}`)))
    }

    const ac = new AbortController()
    /** @type {number[]} */
    const batchSizes = []
    const indexer = /** @type {API.IndexingServiceReader} */ ({
      async queryClaims({ hashes }) {
        batchSizes.push(hashes.length)
        ac.abort()
        return {
          ok: {
            claims: new Map(),
            indexes: new Map(),
          },
        }
      },
    })

    await expect(
      resolveClaimsIndex({
        indexer,
        shards,
        fetcher: undefined,
        signal: ac.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(batchSizes).toEqual([MAX_QUERY_CLAIMS_HASHES_PER_REQUEST])
  })

  it('bounds concurrent primary queryClaims requests to the configured limit', async () => {
    /** @type {API.ShardEntry[]} */
    const shards = []
    for (
      let index = 0;
      index < MAX_QUERY_CLAIMS_HASHES_PER_REQUEST * 2 + 1;
      index += 1
    ) {
      shards.push(
        createShardEntry(await createTestCID(`shard-concurrency-${index}`))
      )
    }

    let inFlight = 0
    let maxInFlight = 0
    let releaseGate = () => {}
    /** @type {Promise<void>} */
    const gate = new Promise((resolve) => {
      releaseGate = () => resolve()
    })

    const indexer = /** @type {API.IndexingServiceReader} */ (
      /** @type {unknown} */ ({
        async queryClaims() {
          inFlight += 1
          maxInFlight = Math.max(maxInFlight, inFlight)
          await gate
          inFlight -= 1
          return {
            ok: {
              claims: new Map(),
              indexes: new Map(),
            },
          }
        },
      })
    )

    const run = resolveClaimsIndex({
      indexer,
      shards,
      fetcher: undefined,
      queryClaimsBatchConcurrency: 2,
    })

    await waitFor(() => maxInFlight === 2)
    releaseGate()
    await run

    expect(maxInFlight).toBe(2)
  })
})

/**
 * @param {() => boolean} predicate
 */
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error('waitFor: condition was not met in time')
}
