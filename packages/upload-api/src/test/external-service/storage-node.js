import * as API from '../../types.js'
import * as BlobCapabilities from '@storacha/capabilities/blob'
import * as BlobReplicaCapabilities from '@storacha/capabilities/blob/replica'
import * as ClaimCapabilities from '@storacha/capabilities/claim'
import { base64pad } from 'multiformats/bases/base64'
import { base58btc } from 'multiformats/bases/base58'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Digest from 'multiformats/hashes/digest'
import { ok, error, Receipt } from '@ucanto/core'
import { ed25519 } from '@ucanto/principal'
import { CAR, HTTP } from '@ucanto/transport'
import * as Server from '@ucanto/server'
import { connect } from '@ucanto/client'
import {
  AllocatedMemoryNotWrittenError,
  BlobSizeLimitExceededError,
} from '../../blob.js'
import { createConcludeInvocation } from '../../ucan/conclude.js'
import { createLocationCommitment } from '../helpers/blob.js'

/**
 * @typedef {{
 *   has: (digest: API.MultihashDigest) => Promise<boolean>
 *   get: (digest: API.MultihashDigest) => Promise<Uint8Array|undefined>
 *   set: (digest: API.MultihashDigest, bytes: Uint8Array) => Promise<boolean>
 * }} ContentStore
 * @typedef {{
 *   has: (digest: API.MultihashDigest) => Promise<boolean>
 *   add: (digest: API.MultihashDigest) => Promise<void>
 * }} AllocationStore
 * @typedef {import('../../types/blob.js').BlobService} BlobService
 */

export const MaxUploadSize = 127 * (1 << 25)

/** @param {API.MultihashDigest} digest */
const contentKey = (digest) => {
  const encodedMultihash = base58btc.encode(digest.bytes)
  return `${encodedMultihash}/${encodedMultihash}.blob`
}

/** @param {string} key */
const contentDigest = (key) =>
  Digest.decode(
    base58btc.decode(key.split('/').pop()?.replace('.blob', '') ?? '')
  )

/**
 * @param {{
 *   id: API.Signer
 *   baseURL: () => URL
 *   indexingService: API.IndexingServiceAPI.ClientConfig
 *   contentStore: Omit<ContentStore, 'set'>
 *   allocationStore: AllocationStore
 * }} config
 * @returns {BlobService}
 */
const createService = ({
  id,
  baseURL,
  indexingService,
  contentStore,
  allocationStore,
}) => ({
  blob: {
    allocate: Server.provideAdvanced({
      capability: BlobCapabilities.allocate,
      handler: async ({ capability }) => {
        const digest = Digest.decode(capability.nb.blob.digest)
        const checksum = base64pad.baseEncode(digest.digest)
        if (capability.nb.blob.size > MaxUploadSize) {
          return error(
            new BlobSizeLimitExceededError(
              capability.nb.blob.size,
              MaxUploadSize
            )
          )
        }
        if (await contentStore.has(digest)) {
          return ok({ size: 0 })
        }

        const size = (await allocationStore.has(digest))
          ? 0
          : capability.nb.blob.size
        await allocationStore.add(digest)

        return ok({
          size,
          address: {
            url: new URL(contentKey(digest), baseURL()).toString(),
            headers: { 'x-amz-checksum-sha256': checksum },
            expires: 60 * 60 * 24,
          },
        })
      },
    }),
    accept: Server.provideAdvanced({
      capability: BlobCapabilities.accept,
      handler: async ({ capability }) => {
        const digest = Digest.decode(capability.nb.blob.digest)
        if (!(await contentStore.has(digest))) {
          return error(new AllocatedMemoryNotWrittenError())
        }

        const claim = await createLocationCommitment({
          issuer: id,
          with: id.did(),
          audience: capability.nb.space,
          digest,
          location:
            /** @type {API.URI} */
            (new URL(contentKey(digest), baseURL()).toString()),
          space: capability.nb.space,
        }).delegate()

        const receipt = await ClaimCapabilities.cache
          .invoke({
            issuer: id,
            audience: indexingService.invocationConfig.audience,
            with: id.did(),
            nb: {
              claim: claim.cid,
              provider: {
                addresses: [], // TODO: add addresses?
              },
            },
            expiration: Infinity,
            proofs: [claim],
          })
          .execute(indexingService.connection)
        if (receipt.out.error) {
          return receipt.out
        }

        return Server.ok({ site: claim.cid }).fork(claim)
      },
    }),
    replica: {
      /** @type {API.ServiceMethod<API.BlobReplicaAllocate, API.BlobReplicaAllocateSuccess, API.BlobReplicaAllocateFailure>} */
      allocate: Server.provideAdvanced({
        capability: BlobReplicaCapabilities.allocate,
        handler: async ({ capability, invocation }) => {
          const { blob, space, site } = capability.nb
          const digest = Digest.decode(blob.digest)
          const hasDigest = await allocationStore.has(digest)
          const transferTask = await BlobReplicaCapabilities.transfer.delegate({
            issuer: id,
            audience: id,
            with: id.did(),
            nb: { blob, space, site, cause: invocation.cid },
          })

          // if we already have the digest, we can issue a transfer receipt
          if (hasDigest) {
            const claim = await createLocationCommitment({
              issuer: id,
              with: id.did(),
              audience: space,
              digest,
              location:
                /** @type {API.URI} */
                (new URL(contentKey(digest), baseURL()).toString()),
              space,
            }).delegate()

            const claimRcpt = await ClaimCapabilities.cache
              .invoke({
                issuer: id,
                audience: indexingService.invocationConfig.audience,
                with: id.did(),
                nb: {
                  claim: claim.cid,
                  provider: {
                    addresses: [], // TODO: add addresses?
                  },
                },
                expiration: Infinity,
                proofs: [claim],
              })
              .execute(indexingService.connection)
            if (claimRcpt.out.error) {
              return claimRcpt.out
            }

            const transferRcpt = await Receipt.issue({
              issuer: id,
              ran: transferTask,
              result: Server.ok({ site: claim.cid }),
              fx: {
                // communicate the location commitment
                fork: [claim],
              },
            })

            return Server.ok(
              /** @type {API.BlobReplicaAllocateSuccess} */ ({
                size: 0,
                site: { 'ucan/await': ['.out.ok.site', transferTask.cid] },
              })
            )
              .fork(transferTask)
              .fork(
                await createConcludeInvocation(id, id, transferRcpt).delegate()
              )
          }

          const blocks = [...invocation.iterateIPLDBlocks()]
          if (!blocks.some((b) => b.cid.toString() === site.toString())) {
            return Server.error({
              name: 'MissingLocationCommitment',
              message: `root block not found: ${site}`,
            })
          }

          await allocationStore.add(digest)

          return Server.ok(
            /** @type {API.BlobReplicaAllocateSuccess} */ ({
              size: capability.nb.blob.size,
              site: { 'ucan/await': ['.out.ok.site', transferTask.cid] },
            })
          ).fork(transferTask)
        },
      }),
    },
  },
})

// The browser storage node has an external bucket where data is sent, started
// before the browser tests begin.
export class BrowserStorageNode {
  /** @param {{ port?: number, indexingService: API.IndexingServiceAPI.ClientConfig } & import('@ucanto/interface').PrincipalResolver} config */
  static async activate({ indexingService, resolveDIDKey, port }) {
    const id = await ed25519.generate()
    const baseURL = new URL(`http://127.0.0.1:${port ?? 8989}`)

    const contentStore = {
      /** @param {API.MultihashDigest} digest */
      has: async (digest) => {
        const res = await fetch(new URL(contentKey(digest), baseURL))
        return res.status === 200
      },
      /** @param {API.MultihashDigest} digest */
      get: async (digest) => {
        const res = await fetch(new URL(contentKey(digest), baseURL))
        return res.status === 200
          ? new Uint8Array(await res.arrayBuffer())
          : undefined
      },
    }

    const allocations = new Set()
    const allocationStore = {
      /** @param {API.MultihashDigest} digest */
      has: async (digest) => allocations.has(contentKey(digest)),
      /** @param {API.MultihashDigest} digest */
      add: async (digest) => {
        allocations.add(contentKey(digest))
      },
    }

    const server = Server.create({
      id,
      codec: CAR.inbound,
      service: createService({
        id,
        baseURL: () => baseURL,
        indexingService,
        contentStore,
        allocationStore,
      }),
      resolveDIDKey,
      validateAuthorization: () => ({ ok: {} }),
    })

    const connection = connect({ id, codec: CAR.outbound, channel: server })

    return new BrowserStorageNode({ id, baseURL, connection })
  }

  /**
   * @param {{
   *   id: API.Signer
   *   connection: import('@ucanto/interface').ConnectionView<BlobService>
   *   baseURL: URL
   * }} config
   */
  constructor({ id, baseURL, connection }) {
    this.id = id
    this.baseURL = baseURL
    this.connection = connection
  }

  async deactivate() {
    try {
      await fetch(new URL('/reset', this.baseURL), { method: 'POST' })
    } catch {
      // Ignore errors
    }
  }
}

export class StorageNode {
  /** @param {{ http: import('http'), indexingService: API.IndexingServiceAPI.ClientConfig } & import('@ucanto/interface').PrincipalResolver} config */
  static async activate({ http, indexingService, resolveDIDKey }) {
    const id = await ed25519.generate()
    /** @type {URL} */
    let baseURL

    const content = new Map()
    const contentStore = {
      /** @param {API.MultihashDigest} digest */
      has: async (digest) => content.has(contentKey(digest)),
      /** @param {API.MultihashDigest} digest */
      get: async (digest) => content.get(contentKey(digest)),
      /**
       * @param {API.MultihashDigest} digest
       * @param {Uint8Array} bytes
       */
      set: async (digest, bytes) => {
        content.set(contentKey(digest), bytes)
      },
    }

    const allocations = new Set()
    const allocationStore = {
      /** @param {API.MultihashDigest} digest */
      has: async (digest) => allocations.has(contentKey(digest)),
      /** @param {API.MultihashDigest} digest */
      add: async (digest) => {
        allocations.add(contentKey(digest))
      },
    }

    const server = Server.create({
      id,
      codec: CAR.inbound,
      service: createService({
        id,
        baseURL: () => baseURL,
        indexingService,
        contentStore,
        allocationStore,
      }),
      resolveDIDKey,
      validateAuthorization: () => ({ ok: {} }),
    })

    const httpServer = http.createServer(async (request, response) => {
      try {
        const { pathname } = new URL(request.url ?? '/', baseURL)
        if (request.method === 'POST') {
          const chunks = []
          for await (const chunk of request) {
            chunks.push(chunk)
          }

          const { status, headers, body } = await server.request({
            headers: Object.fromEntries(
              Object.entries(request.headers).map(([k, v]) => [k, String(v)])
            ),
            body: new Uint8Array(await new Blob(chunks).arrayBuffer()),
          })

          response.writeHead(status ?? 200, headers)
          response.write(body)
        } else if (request.method === 'PUT') {
          const length = parseInt(request.headers['content-length'] ?? '0')
          const buffer = new Uint8Array(length)
          let offset = 0
          for await (const chunk of request) {
            buffer.set(chunk, offset)
            offset += chunk.length
          }
          const digest = await sha256.digest(buffer)
          const checksum = base64pad.baseEncode(digest.digest)

          if (checksum !== request.headers['x-amz-checksum-sha256']) {
            response.writeHead(400, `checksum mismatch`)
          } else {
            await contentStore.set(digest, buffer)
            response.writeHead(200)
          }
        } else if (request.method === 'GET') {
          const data = await contentStore.get(contentDigest(pathname))
          if (data) {
            response.writeHead(200)
            response.write(data)
          } else {
            response.writeHead(404)
          }
        } else {
          response.writeHead(405)
        }
      } catch (err) {
        console.error(err)
        response.writeHead(500)
      }

      response.end()
      // otherwise it keep connection lingering
      response.destroy()
    })
    await new Promise((resolve) => httpServer.listen(resolve))

    // @ts-ignore - this is actually what it returns on http
    const { port } = httpServer.address()
    baseURL = new URL(`http://127.0.0.1:${port}`)
    const channel = HTTP.open({ url: baseURL, method: 'POST' })
    const connection = connect({ id, codec: CAR.outbound, channel })

    return new StorageNode({ id, connection, server: httpServer })
  }

  /**
   * @param {{
   *   id: API.Signer
   *   connection: import('@ucanto/interface').ConnectionView<BlobService>
   *   server: import('http').Server
   * }} config
   */
  constructor({ id, connection, server }) {
    this.id = id
    this.connection = connection
    this.server = server
  }

  async deactivate() {
    await new Promise((resolve, reject) => {
      this.server.closeAllConnections()
      this.server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve(undefined)
        }
      })
    })
  }
}
