import fs from 'node:fs'
import path from 'node:path'
// @ts-expect-error no typings :(
import tree from 'pretty-tree'
import { importDAG, extract } from '@ucanto/core/delegation'
import * as CAR from '@ucanto/transport/car'
import * as Signer from '@ucanto/principal/ed25519'
import * as Link from 'multiformats/link'
import { base58btc } from 'multiformats/bases/base58'
import * as Digest from 'multiformats/hashes/digest'
import * as raw from 'multiformats/codecs/raw'
import { parse } from '@ipld/dag-ucan/did'
import * as dagJSON from '@ipld/dag-json'
import { create } from '@storacha/client'
import * as Service from '@storacha/client/service'
import { StoreConf } from '@storacha/client/stores/conf'
import * as DIDMailto from '@storacha/did-mailto'
import { CarReader } from '@ipld/car'
import { select } from '@inquirer/prompts'
import { Account } from '@storacha/client/account'

/**
 * @typedef {import('@storacha/client/types').AnyLink} AnyLink
 * @typedef {import('@storacha/client/types').CARLink} CARLink
 * @typedef {import('@storacha/client/types').FileLike & { size: number }} FileLike
 * @typedef {import('@storacha/client/types').SpaceBlobListSuccess} BlobListSuccess
 * @typedef {import('@storacha/client/types').UploadListSuccess} UploadListSuccess
 * @typedef {import('@storacha/capabilities/types').FilecoinInfoSuccess} FilecoinInfoSuccess
 */

/**
 *
 */
export function getPkg() {
  // @ts-ignore JSON.parse works with Buffer in Node.js
  return JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)))
}

/** @param {string[]|string} paths */
export function checkPathsExist(paths) {
  paths = Array.isArray(paths) ? paths : [paths]
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      console.error(`The path ${path.resolve(p)} does not exist`)
      process.exit(1)
    }
  }
  return paths
}

/** @param {number} bytes */
export function filesize(bytes) {
  if (bytes < 50) return `${bytes}B` // avoid 0.0KB
  if (bytes < 50000) return `${(bytes / 1000).toFixed(1)}KB` // avoid 0.0MB
  if (bytes < 50000000) return `${(bytes / 1000 / 1000).toFixed(1)}MB` // avoid 0.0GB
  return `${(bytes / 1000 / 1000 / 1000).toFixed(1)}GB`
}

/** @param {number} bytes */
export function filesizeMB(bytes) {
  return `${(bytes / 1000 / 1000).toFixed(1)}MB`
}

/** Get a configured w3up store used by the CLI. */
export function getStore() {
  return new StoreConf({
    profile: process.env.STORACHA_STORE_NAME ?? 'storacha-cli',
  })
}

/**
 * Get a new API client configured from env vars.
 */
export function getClient() {
  const store = getStore()

  const uploadServiceDID = process.env.STORACHA_SERVICE_DID
    ? parse(process.env.STORACHA_SERVICE_DID)
    : undefined
  const uploadServiceURL = process.env.STORACHA_SERVICE_URL
    ? new URL(process.env.STORACHA_SERVICE_URL)
    : undefined
  const receiptsEndpointString = process.env.STORACHA_RECEIPTS_URL
  let receiptsEndpoint
  if (receiptsEndpointString) {
    receiptsEndpoint = new URL(receiptsEndpointString)
  }

  let serviceConf
  if (uploadServiceDID && uploadServiceURL) {
    serviceConf =
      /** @type {import('@storacha/client/types').ServiceConf} */
      ({
        access: Service.accessServiceConnection({
          id: uploadServiceDID,
          url: uploadServiceURL,
        }),
        upload: Service.uploadServiceConnection({
          id: uploadServiceDID,
          url: uploadServiceURL,
        }),
        filecoin: Service.filecoinServiceConnection({
          id: uploadServiceDID,
          url: uploadServiceURL,
        }),
        gateway: Service.gatewayServiceConnection(),
      })
  }

  /** @type {import('@storacha/client/types').ClientFactoryOptions} */
  const createConfig = { store, serviceConf, receiptsEndpoint }

  const principal = process.env.STORACHA_PRINCIPAL
  if (principal) {
    createConfig.principal = Signer.parse(principal)
  }

  return create(createConfig)
}

/**
 * @param {string} path Path to the proof file.
 */
export async function readProof(path) {
  let bytes
  try {
    const buff = await fs.promises.readFile(path)
    bytes = new Uint8Array(buff.buffer)
  } catch (/** @type {any} */ err) {
    console.error(`Error: failed to read proof: ${err.message}`)
    process.exit(1)
  }
  return readProofFromBytes(bytes)
}

/**
 * @param {Uint8Array} bytes Path to the proof file.
 */
export async function readProofFromBytes(bytes) {
  const extractRes = await extract(bytes)
  if (extractRes.ok) {
    return extractRes.ok
  }

  // try legacy extract
  const blocks = []
  try {
    const reader = await CarReader.fromBytes(bytes)
    for await (const block of reader.blocks()) {
      blocks.push(block)
    }
  } catch (/** @type {any} */ err) {
    console.error(`Error: failed to parse proof: ${err.message}`)
    process.exit(1)
  }
  try {
    return importDAG(blocks)
  } catch (/** @type {any} */ err) {
    console.error(`Error: failed to import proof: ${err.message}`)
    process.exit(1)
  }
}

/**
 * @param {UploadListSuccess} res
 * @param {object} [opts]
 * @param {boolean} [opts.raw]
 * @param {boolean} [opts.json]
 * @param {boolean} [opts.shards]
 * @param {boolean} [opts.plainTree]
 * @returns {string}
 */
export function uploadListResponseToString(res, opts = {}) {
  if (opts.json) {
    return res.results
      .map(({ root, shards, insertedAt, updatedAt }) =>
        dagJSON.stringify({ root, shards, insertedAt, updatedAt })
      )
      .join('\n')
  } else if (opts.shards) {
    return res.results
      .map(({ root, shards }) => {
        const treeBuilder = opts.plainTree ? tree.plain : tree
        return treeBuilder({
          label: root.toString(),
          nodes: [
            {
              label: 'shards',
              leaf: shards?.map((s) => s.toString()),
            },
          ],
        })
      })
      .join('\n')
  } else {
    return res.results.map(({ root }) => root.toString()).join('\n')
  }
}

/**
 * @param {BlobListSuccess} res
 * @param {object} [opts]
 * @param {boolean} [opts.raw]
 * @param {boolean} [opts.json]
 * @returns {string}
 */
export function blobListResponseToString(res, opts = {}) {
  if (opts.json) {
    return res.results.map(({ blob }) => dagJSON.stringify({ blob })).join('\n')
  } else {
    return res.results
      .map(({ blob }) => {
        const digest = Digest.decode(blob.digest)
        const cid = Link.create(raw.code, digest)
        return `${base58btc.encode(digest.bytes)} (${cid})`
      })
      .join('\n')
  }
}

/**
 * @param {FilecoinInfoSuccess} res
 * @param {object} [opts]
 * @param {boolean} [opts.raw]
 * @param {boolean} [opts.json]
 */
export function filecoinInfoToString(res, opts = {}) {
  if (opts.json) {
    return res.deals
      .map((deal) =>
        dagJSON.stringify({
          aggregate: deal.aggregate.toString(),
          provider: deal.provider,
          dealId: deal.aux.dataSource.dealID,
          inclusion: res.aggregates.find(
            (a) => a.aggregate.toString() === deal.aggregate.toString()
          )?.inclusion,
        })
      )
      .join('\n')
  } else {
    if (!res.deals.length) {
      return `
      Piece CID: ${res.piece.toString()}
      Deals: Piece being aggregated and offered for deal...
      `
    }
    // not showing inclusion proof as it would just be bytes
    return `
    Piece CID: ${res.piece.toString()}
    Deals: ${res.deals
      .map(
        (deal) => `
      Aggregate: ${deal.aggregate.toString()}
       Provider: ${deal.provider}
        Deal ID: ${deal.aux.dataSource.dealID}
    `
      )
      .join('')}
    `
  }
}

/**
 * Return validated CARLink or undefined
 *
 * @param {AnyLink} cid
 */
export function asCarLink(cid) {
  if (cid.version === 1 && cid.code === CAR.codec.code) {
    return /** @type {CARLink} */ (cid)
  }
}

/**
 * Return validated CARLink type or exit the process with an error code and message
 *
 * @param {string} cidStr
 */
export function parseCarLink(cidStr) {
  try {
    return asCarLink(Link.parse(cidStr.trim()))
  } catch {
    return undefined
  }
}

/**
 * @param {string} email
 * @returns {{ok: DIDMailto.EmailAddress, error?:void}|{ok?:void, error: Error}}
 */
export const parseEmail = (email) => {
  try {
    return { ok: DIDMailto.email(email) }
  } catch (cause) {
    return { error: /** @type {Error} */ (cause) }
  }
}

/** @param {string|number|Date} now */
const startOfMonth = (now) => {
  const d = new Date(now)
  d.setUTCDate(1)
  d.setUTCHours(0)
  d.setUTCMinutes(0)
  d.setUTCSeconds(0)
  d.setUTCMilliseconds(0)
  return d
}

/** @param {string|number|Date} now */
export const startOfLastMonth = (now) => {
  const d = startOfMonth(now)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d
}

/** @param {ReadableStream<Uint8Array>} source */
export const streamToBlob = async (source) => {
  const chunks = /** @type {Uint8Array[]} */ ([])
  await source.pipeTo(
    new WritableStream({
      write: (chunk) => {
        chunks.push(chunk)
      },
    })
  )
  return new Blob(chunks)
}

/**
 * @param {Record<string, any>} options
 * @returns {import('@storacha/access/types').SpaceAccessType}
 */
export const parseAccessFromOptions = (options) => {
  // Validate access type
  if (
    options['access-type'] &&
    !['public', 'private'].includes(options['access-type'])
  ) {
    console.error('Invalid access type. Must be either "public" or "private"')
    process.exit(1)
  }

  // Validate encryption provider
  if (
    options['encryption-provider'] &&
    !['google-kms'].includes(options['encryption-provider'])
  ) {
    console.error('Invalid encryption provider. Must be "google-kms"')
    process.exit(1)
  }

  // Create access type object
  const accessType = options['access-type'] || 'public'

  if (accessType === 'public') {
    return { type: 'public' }
  } else {
    const provider = options['encryption-provider'] || 'google-kms'

    // Ensure only Google KMS is supported
    if (provider !== 'google-kms') {
      console.error(
        'Invalid encryption provider. Only "google-kms" is supported for private spaces.'
      )
      process.exit(1)
    }

    const algorithm =
      options['encryption-algorithm'] || 'RSA_DECRYPT_OAEP_3072_SHA256'

    return {
      type: 'private',
      encryption: { provider, algorithm },
    }
  }
}

/**
 *
 * @param {Account} account
 * @returns {Promise<import('@ucanto/interface').Result<{planID: import('@ipld/dag-ucan').DID}, Error>>}
 */
export async function chooseBillingPlanAndCheckout(account) {
  console.log(`\u001b[1;31m 
To get started uploading data you'll need to sign up for a subscription. If you choose the Starter plan
we won't charge your credit card, but we do need a card on file before we will store your bits.

Pick a plan below and complete the Stripe checkout flow to get started!
 ______________________________________________________________________________________
|                            |                            |                            | 
| MILD                       | MEDIUM                     | EXTRA SPICY                |
|____________________________|____________________________|____________________________|
|                            |                            |                            |
| $0/mo                      | $10/mo                     | $100/mo                    | 
| 5GB Storage                | 100GB Storage              | 2000GB Storage             |
| Add'l storage $0.15 GB/mo. | Add'l storage $0.05 GB/mo. | Add'l storage $0.03 GB/mo. |
| 5GB Egress                 | 100GB Egress               | 2000GB Egress.             |
| Add'l egress $0.15 GB/mo.  | Add'l egress $0.05 GB/mo.  | Add'l egress $0.03 GB/mo.  |
|____________________________|____________________________|____________________________|

NOTE: Prices may have changed since this CLI was installed - please see https://storacha.network/#pricing for our latest plan pricing.
`)

  /** @type {import('@ipld/dag-ucan').DID} */
  const selectedPlan = await select({
    message: 'Please choose a plan:',
    choices: [
      { name: 'Mild        🌶️', value: 'did:web:starter.storacha.network' },
      { name: 'Medium      🌶️ 🌶️', value: 'did:web:lite.storacha.network' },
      {
        name: 'Extra Spicy 🌶️ 🌶️ 🌶️',
        value: 'did:web:business.storacha.network',
      },
    ],
  })
  const checkoutSessionResponse = await account.plan.createCheckoutSession(
    account.did(),
    {
      planID: selectedPlan,
      redirectAfterCompletion: false,
    }
  )
  if (checkoutSessionResponse.error) {
    return checkoutSessionResponse
  }
  console.log(
    `Excellent choice! Please visit ${checkoutSessionResponse.ok?.url} to enter payment details. Come back here once you've successfully checked out.`
  )
  return { ok: { planID: selectedPlan } }
}
