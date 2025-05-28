import * as Server from '@ucanto/server'
import { connect } from '@ucanto/client'
import { ed25519 } from '@ucanto/principal'
import { CAR, HTTP } from '@ucanto/transport'
import * as AssertCaps from '@storacha/capabilities/assert'
import * as ClaimCaps from '@storacha/capabilities/claim'
import { DigestMap } from '@storacha/blob-index'
import * as Digest from 'multiformats/hashes/digest'
import * as QueryResult from '@storacha/indexing-service-client/query-result'
import * as Claim from '@storacha/indexing-service-client/claim'

/**
 * @import * as API from '../../types.js'
 * @import { IndexingServiceAPI } from '../../types.js'
 * @import { NetworkError } from '@storacha/indexing-service-client/api'
 */

/**
 * @param {object} params
 * @param {API.Signer} params.serviceSigner
 * @param {API.Transport.Channel<IndexingServiceAPI.Service>} params.channel
 * @returns {Promise<IndexingServiceAPI.ClientConfig>}
 */
export const create = async ({ serviceSigner, channel }) => {
  const agent = await ed25519.generate()
  const proofs = [
    await AssertCaps.assert.delegate({
      issuer: serviceSigner,
      with: serviceSigner.did(),
      audience: agent,
    }),
  ]
  return {
    invocationConfig: {
      issuer: agent,
      with: serviceSigner.did(),
      audience: serviceSigner,
      proofs,
    },
    connection: connect({
      id: serviceSigner,
      codec: CAR.outbound,
      channel,
    }),
  }
}

/**
 * @param {{ http?: import('node:http') }} [options]
 * @returns {Promise<IndexingServiceAPI.ClientConfig & IndexingServiceAPI.Client & API.Deactivator>}
 */
export const activate = async ({ http } = {}) => {
  const serviceSigner = await ed25519.generate()

  const claimStore = new ClaimStorage()
  /** @type {IndexingServiceAPI.Client['queryClaims']} */
  const queryClaims = async (query) => {
    const claims = []
    for (const digest of query.hashes) {
      claims.push(...claimStore.get(digest))
    }
    const res = await QueryResult.from({ claims })
    if (res.error) {
      // an error encoding the query result would be a 500 server error
      return Server.error(
        /** @type {NetworkError} */ ({
          ...res.error,
          name: 'NetworkError',
        })
      )
    }
    return res
  }

  const server = Server.create({
    id: serviceSigner,
    codec: CAR.inbound,
    service: {
      assert: {
        index: Server.provide(AssertCaps.index, ({ invocation: inv }) => {
          const claim = Claim.view({ root: inv.root.cid, blocks: inv.blocks })
          claimStore.put(claim)
          return Server.ok({})
        }),
        equals: Server.provide(AssertCaps.equals, ({ invocation: inv }) => {
          const claim = Claim.view({ root: inv.root.cid, blocks: inv.blocks })
          claimStore.put(claim)
          return Server.ok({})
        }),
      },
      claim: {
        cache: Server.provide(
          ClaimCaps.cache,
          ({ capability, invocation: inv }) => {
            const root = /** @type {API.UCANLink} */ (capability.nb.claim)
            const claim = Claim.view({ root, blocks: inv.blocks })
            claimStore.put(claim)
            return Server.ok({})
          }
        ),
      },
    },
    validateAuthorization: () => ({ ok: {} }),
  })

  if (!http) {
    const conf = await create({ serviceSigner, channel: server })
    return Object.assign(conf, { queryClaims, deactivate: async () => {} })
  }

  const httpServer = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }

    const { status, headers, body } = await server.request({
      // @ts-expect-error
      headers: req.headers,
      body: new Uint8Array(await new Blob(chunks).arrayBuffer()),
    })

    res.writeHead(status ?? 200, headers)
    res.write(body)
    res.end()
  })
  await new Promise((resolve) => httpServer.listen(resolve))
  // @ts-expect-error
  const { port } = httpServer.address()
  const serviceURL = new URL(`http://127.0.0.1:${port}`)

  const channel = HTTP.open({ url: serviceURL, method: 'POST' })
  const conf = await create({ serviceSigner, channel })
  return Object.assign(conf, {
    queryClaims,
    deactivate: () =>
      new Promise((resolve, reject) => {
        httpServer.closeAllConnections()
        httpServer.close((err) => {
          if (err) {
            reject(err)
          } else {
            resolve(undefined)
          }
        })
      }),
  })
}

class ClaimStorage {
  constructor() {
    /** @type {Map<API.MultihashDigest, IndexingServiceAPI.Claim[]>} */
    this.data = new DigestMap()
  }

  /** @param {IndexingServiceAPI.Claim} claim */
  put(claim) {
    const digest =
      'multihash' in claim.content
        ? claim.content.multihash
        : Digest.decode(claim.content.digest)
    const claims = this.data.get(digest) ?? []
    claims.push(claim)
    this.data.set(digest, claims)
  }

  /** @param {API.MultihashDigest} content */
  get(content) {
    return this.data.get(content) ?? []
  }
}
