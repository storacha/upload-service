import pMap from 'p-map'
import { decode as decodeDagCbor } from '@ipld/dag-cbor'
import { Piece } from '@web3-storage/data-segment'
import { base58btc } from 'multiformats/bases/base58'
import { base32upper } from 'multiformats/bases/base32'
import { CID } from 'multiformats/cid'
import * as RAW from 'multiformats/codecs/raw'

/**
 * @import {
 *  ClaimsEntry,
 *  IndexingServiceReader,
 *  PieceLink,
 *  ShardEntry,
 *  MultihashDigest
 * } from '../api.js'
 * @import {
 *  EqualsClaimMetadata,
 *  IPNIFindResponse,
 *  IPNIProviderResult,
 *  LocationCommitmentMetadata
 * } from './indexer.types.js'
 */

const CID_CONTACT_URL = 'https://cid.contact'
const DEFAULT_IPNI_CONCURRENCY = 8
// Storacha claim metadata protocols from go-libstoracha/metadata/metadata.go.
const LOCATION_COMMITMENT_PROTOCOL = 0x3e0002
const EQUALS_CLAIM_PROTOCOL = 0x3e0001

/**
 * Resolve shard claims via the primary indexing service, then repair any
 * missing location / piece data from cid.contact IPNI lookups.
 *
 * Returns a Map keyed by b58 multihash → { locationURL, piece, size }.
 *
 * @param {object} args
 * @param {IndexingServiceReader} args.indexer
 * @param {ShardEntry[]} args.shards
 * @param {typeof fetch | undefined} args.fetcher
 * @returns {Promise<Map<string, ClaimsEntry>>}
 */
export async function resolveClaimsIndex({ indexer, shards, fetcher }) {
  /** @type {Map<string, ClaimsEntry>} */
  const index = new Map()
  if (shards.length === 0) return index

  const requestedShardB58s = new Set()
  /** @type {string[]} */
  const requestedShardB58List = []
  /** @type {MultihashDigest[]} */
  const hashes = []
  /** @type {Map<string, ShardEntry>} */
  const shardsByB58 = new Map()

  for (const shard of shards) {
    if (requestedShardB58s.has(shard.b58)) continue

    requestedShardB58s.add(shard.b58)
    requestedShardB58List.push(shard.b58)
    hashes.push(shard.multihash)
    shardsByB58.set(shard.b58, shard)
  }

  let primarySucceeded = false
  try {
    const claimsResult = await indexer.queryClaims({
      hashes,
      kind: 'standard',
    })

    if (claimsResult.ok) {
      primarySucceeded = true
      applyPrimaryClaims(
        index,
        requestedShardB58s,
        claimsResult.ok.claims.values()
      )
    }
  } catch {
    // Best-effort fallback below.
  }

  const missingB58s = primarySucceeded
    ? requestedShardB58List.filter((b58) =>
        isClaimsEntryIncomplete(index.get(b58))
      )
    : requestedShardB58List

  if (missingB58s.length === 0 || typeof fetcher !== 'function') {
    return index
  }

  await applyIPNIFallback({
    b58s: missingB58s,
    index,
    shardsByB58,
    fetcher,
  })

  return index
}

/**
 * Merge primary indexing-service claims into the shared lookup index.
 *
 * @param {Map<string, ClaimsEntry>} index
 * @param {Set<string>} requestedShardB58s
 * @param {Iterable<unknown>} claims
 */
function applyPrimaryClaims(index, requestedShardB58s, claims) {
  for (const claim of claims) {
    const b58 = getClaimContentB58(claim)
    if (!b58 || !requestedShardB58s.has(b58)) continue

    if (isLocationClaim(claim)) {
      handleLocationClaim(index, b58, claim)
    } else if (isEqualsClaim(claim)) {
      handleEqualsClaim(index, b58, claim)
    }
  }
}

/**
 * Repair incomplete claims entries from cid.contact IPNI provider results.
 *
 * @param {object} args
 * @param {string[]} args.b58s
 * @param {Map<string, ClaimsEntry>} args.index
 * @param {Map<string, ShardEntry>} args.shardsByB58
 * @param {typeof fetch} args.fetcher
 */
async function applyIPNIFallback({ b58s, index, shardsByB58, fetcher }) {
  await pMap(
    b58s,
    async (b58) => {
      const shard = shardsByB58.get(b58)
      if (!shard) return

      const providerResults = await fetchIPNIProviderResults(fetcher, b58)
      if (providerResults.length === 0) return

      const entry = getOrCreateClaimsEntry(index, b58)
      for (const providerResult of providerResults) {
        mergeProviderResult(entry, providerResult, shard)
        if (entry.locationURL !== null && entry.piece !== null) {
          break
        }
      }
    },
    { concurrency: DEFAULT_IPNI_CONCURRENCY }
  )
}

/**
 * @param {typeof fetch} fetcher
 * @param {string} b58
 * @returns {Promise<IPNIProviderResult[]>}
 */
async function fetchIPNIProviderResults(fetcher, b58) {
  try {
    const value = b58.charAt(0) === 'z' ? b58.substring(1) : b58
    const response = await fetcher(`${CID_CONTACT_URL}/multihash/${value}`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return []

    const body = /** @type {IPNIFindResponse} */ (await response.json())
    return body.MultihashResults?.[0]?.ProviderResults ?? []
  } catch {
    return []
  }
}

/**
 * Merge one IPNI provider result into a shared claims entry.
 *
 * @param {ClaimsEntry} entry
 * @param {IPNIProviderResult} providerResult
 * @param {ShardEntry} shard
 */
function mergeProviderResult(entry, providerResult, shard) {
  if (!providerResult.Metadata) return

  const metadataBytes = uint8ArrayFromBase64(providerResult.Metadata)
  if (metadataBytes.length === 0) return

  const { value: protocol, bytesRead } = readVarint(metadataBytes)
  const payload = metadataBytes.subarray(bytesRead)
  const providerAddrs = normalizeProviderAddrs(providerResult.Provider?.Addrs)

  if (protocol === LOCATION_COMMITMENT_PROTOCOL) {
    const parsed = parseLocationCommitment(
      payload,
      providerAddrs,
      shard.multihash
    )
    if (!parsed) return

    if (entry.locationURL === null) {
      entry.locationURL = parsed.locationURL
    }
    if (entry.size === 0n && parsed.size > 0n) {
      entry.size = parsed.size
    }
    return
  }

  if (protocol === EQUALS_CLAIM_PROTOCOL) {
    if (entry.piece !== null) return

    const piece = parseEqualsClaimPiece(payload)
    if (piece) {
      entry.piece = piece
    }
    return
  }
}

/**
 * @param {Uint8Array} payload
 * @param {string[]} providerAddrs
 * @param {import('../api.js').MultihashDigest} multihash
 * @returns {{ locationURL: string, size: bigint } | null}
 */
function parseLocationCommitment(payload, providerAddrs, multihash) {
  const locationURL = httpURLFromMultiaddrs(providerAddrs, multihash)
  if (!locationURL) return null

  try {
    const decoded = /** @type {LocationCommitmentMetadata} */ (
      decodeDagCbor(payload)
    )
    // r = [offset, length?] — compact LocationCommitment range encoding.
    const length = Array.isArray(decoded.r) ? decoded.r[1] : undefined
    return {
      locationURL,
      size: length == null ? 0n : toBigInt(length),
    }
  } catch {
    return null
  }
}

/**
 * @param {Uint8Array} payload
 * @returns {import('../api.js').PieceView | null}
 */
function parseEqualsClaimPiece(payload) {
  try {
    const decoded = /** @type {EqualsClaimMetadata} */ (decodeDagCbor(payload))
    // Field name is "=" per metadata.ipldsch: equals Link (rename "=")
    if (!decoded['=']) return null
    return Piece.fromLink(/** @type {PieceLink} */ (decoded['=']))
  } catch {
    return null
  }
}

/**
 * @param {unknown} claim
 * @returns {string | null}
 */
function getClaimContentB58(claim) {
  const content = getClaimContent(claim)
  if (!content) return null

  const multihashBytes = getClaimMultihashBytes(content)
  const digestBytes = getClaimDigestBytes(content)

  const bytes = multihashBytes ?? digestBytes

  return bytes ? base58btc.encode(bytes) : null
}

/**
 * @param {unknown} claim
 * @returns {Record<string, unknown> | null}
 */
function getClaimContent(claim) {
  if (!claim || typeof claim !== 'object') return null
  if (
    !('content' in claim) ||
    !claim.content ||
    typeof claim.content !== 'object'
  ) {
    return null
  }

  return /** @type {Record<string, unknown>} */ (claim.content)
}

/**
 * @param {Record<string, unknown>} content
 * @returns {Uint8Array | null}
 */
function getClaimMultihashBytes(content) {
  if (!('multihash' in content)) return null

  const multihash = content.multihash
  if (!multihash || typeof multihash !== 'object') return null
  if (!('bytes' in multihash)) return null

  return multihash.bytes instanceof Uint8Array ? multihash.bytes : null
}

/**
 * @param {Record<string, unknown>} content
 * @returns {Uint8Array | null}
 */
function getClaimDigestBytes(content) {
  return 'digest' in content && content.digest instanceof Uint8Array
    ? content.digest
    : null
}

/**
 * @param {Map<string, ClaimsEntry>} index
 * @param {string} b58
 * @param {{ location: URL[], range?: { length?: number | bigint } }} claim
 */
function handleLocationClaim(index, b58, claim) {
  const locationURL = claim.location[0]?.toString()
  if (!locationURL) return

  const entry = getOrCreateClaimsEntry(index, b58)
  if (entry.locationURL === null) {
    entry.locationURL = locationURL
  }

  const rangeLength = claim.range?.length
  if (rangeLength != null && entry.size === 0n) {
    entry.size = BigInt(rangeLength)
  }
}

/**
 * @param {Map<string, ClaimsEntry>} index
 * @param {string} b58
 * @param {{ equals: unknown }} claim
 */
function handleEqualsClaim(index, b58, claim) {
  let piece
  try {
    piece = Piece.fromLink(/** @type {PieceLink} */ (claim.equals))
  } catch {
    return
  }

  const entry = getOrCreateClaimsEntry(index, b58)
  if (entry.piece === null) {
    entry.piece = piece
  }
}

/**
 * @param {unknown} claim
 * @returns {claim is { type: 'assert/location', location: URL[], range?: { length?: number | bigint }, content: { digest?: Uint8Array, multihash?: { bytes: Uint8Array } } }}
 */
function isLocationClaim(claim) {
  return Boolean(
    claim &&
      typeof claim === 'object' &&
      'type' in claim &&
      claim.type === 'assert/location'
  )
}

/**
 * @param {unknown} claim
 * @returns {claim is { type: 'assert/equals', equals: unknown, content: { digest?: Uint8Array, multihash?: { bytes: Uint8Array } } }}
 */
function isEqualsClaim(claim) {
  return Boolean(
    claim &&
      typeof claim === 'object' &&
      'type' in claim &&
      claim.type === 'assert/equals'
  )
}

/**
 * Only location + piece are required for a complete reader entry. size may
 * still be 0n because extractShard() can fall back to piece.size.
 *
 * @param {ClaimsEntry | undefined} entry
 */
function isClaimsEntryIncomplete(entry) {
  return !entry || entry.locationURL === null || entry.piece === null
}

/**
 * @param {Map<string, ClaimsEntry>} index
 * @param {string} b58
 * @returns {ClaimsEntry}
 */
function getOrCreateClaimsEntry(index, b58) {
  const existing = index.get(b58)
  if (existing) return existing

  const created = { locationURL: null, piece: null, size: 0n }
  index.set(b58, created)
  return created
}

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function uint8ArrayFromBase64(b64) {
  // Node
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(b64, 'base64'))
  }

  // Browsers
  if (typeof globalThis.atob === 'function') {
    const decoded = globalThis.atob(b64)
    const bytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i)
    }
    return bytes
  }

  throw new Error('No base64 decoder available in this runtime')
}

/**
 * Read a small unsigned varint from provider metadata.
 *
 * This decoder only needs to support the Storacha protocol IDs used here
 * (e.g. 0x3e0001 / 0x3e0002), so it intentionally uses 32-bit bitwise
 * accumulation for speed and simplicity. Because JS bitwise shifts truncate
 * to 32 bits, we stop before attempting any shift above 28 bits.
 *
 * @param {Uint8Array} bytes
 * @returns {{ value: number, bytesRead: number }}
 */
function readVarint(bytes) {
  let value = 0
  let shift = 0
  let i = 0

  while (i < bytes.length) {
    const byte = bytes[i]
    if (shift > 28) {
      return { value, bytesRead: i }
    }
    value |= (byte & 0x7f) << shift
    i += 1

    if ((byte & 0x80) === 0) {
      return { value, bytesRead: i }
    }

    shift += 7
  }

  return { value, bytesRead: i }
}

/**
 * @param {number | bigint} value
 * @returns {bigint}
 */
function toBigInt(value) {
  return typeof value === 'bigint' ? value : BigInt(value)
}

/**
 * @param {string[] | undefined} addrs
 * @returns {string[]}
 */
function normalizeProviderAddrs(addrs) {
  return addrs ?? []
}

/**
 * Extract a usable HTTPS URL from a provider's multiaddr list for a
 * LocationCommitment record.
 *
 * Storacha storage nodes advertise addresses in the form:
 *   /dns/<host>/https/http-path/<url-encoded-template>
 *
 * where the path is a URL-encoded template that must be expanded with the
 * shard multihash. Known templates:
 *   {blob}     → multibase (base32upper) encoding of the multihash bytes
 *   {blobCID}  → default string serialization of the shard CIDv1 with RAW codec
 *
 * Example input:
 *   /dns/carpark-prod-1.r2.w3s.link/https/http-path/%7Bblob%7D%2F%7Bblob%7D.blob
 *
 * Example output (given the shard multihash):
 *   https://carpark-prod-1.r2.w3s.link/{mh}/{mh}.blob
 *
 * Addresses without an http-path template (e.g. /dns4/dag.w3s.link/tcp/443/https)
 * and non-HTTP addresses (e.g. /dns4/elastic.dag.house/tcp/443/wss) are ignored
 * because they carry no range information and cannot be used for byte-range
 * retrieval of a specific shard.
 *
 * @param {string[]} addrs - multiaddr strings from the IPNI ProviderResult
 * @param {import('multiformats').MultihashDigest} multihash - shard multihash used to expand templates
 * @returns {string | null}
 */
function httpURLFromMultiaddrs(addrs, multihash) {
  for (const addr of addrs) {
    const match = addr.match(
      /^\/(dns|dns4|dns6)\/([^/]+)\/https\/http-path\/(.+)$/
    )
    if (!match) continue

    const [, , host, encodedPath] = match
    const path = decodeURIComponent(encodedPath)
    const pathSuffix = path.startsWith('/') ? path.slice(1) : path
    // {blob} is intentionally a multibase base32upper string.
    const expandedPath = pathSuffix
      .replace(/\{blob\}/g, base32upper.encode(multihash.bytes))
      .replace(/\{blobCID\}/g, CID.createV1(RAW.code, multihash).toString())
    if (/\{[^}]+\}/.test(expandedPath)) continue

    return `https://${host}/${expandedPath}`
  }

  return null
}
