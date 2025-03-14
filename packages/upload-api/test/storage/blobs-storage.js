import * as Types from '../../src/types.js'
import { base64pad } from 'multiformats/bases/base64'
import { SigV4 } from '@web3-storage/sigv4'
import { base58btc } from 'multiformats/bases/base58'
import { sha256 } from 'multiformats/hashes/sha2'
import { ok, error } from '@ucanto/core'
import { BlobNotFound } from '../../src/blob/lib.js'

/** @param {Types.MultihashDigest} digest */
const contentKey = (digest) => {
  const encodedMultihash = base58btc.encode(digest.bytes)
  return `${encodedMultihash}/${encodedMultihash}.blob`
}

/**
 * @deprecated
 * @implements {Types.LegacyBlobsStorage}
 * @implements {Types.BlobRetriever}
 */
export class BlobsStorage {
  /**
   * @param {Types.LegacyCarStoreBucketOptions & {http?: import('http')}} options
   */
  static async activate({ http, ...options } = {}) {
    const content = new Map()
    if (http) {
      const server = http.createServer(async (request, response) => {
        const { pathname } = new URL(request.url || '/', url)
        if (request.method === 'PUT') {
          const buffer = new Uint8Array(
            parseInt(request.headers['content-length'] || '0')
          )
          let offset = 0
          for await (const chunk of request) {
            buffer.set(chunk, offset)
            offset += chunk.length
          }
          const hash = await sha256.digest(buffer)
          const checksum = base64pad.baseEncode(hash.digest)

          if (checksum !== request.headers['x-amz-checksum-sha256']) {
            response.writeHead(400, `checksum mismatch`)
          } else {
            content.set(pathname, buffer)
            response.writeHead(200)
          }
        } else if (request.method === 'GET') {
          const data = content.get(pathname)
          if (data) {
            response.writeHead(200)
            response.write(data)
          } else {
            response.writeHead(404)
          }
        } else {
          response.writeHead(405)
        }

        response.end()
        // otherwise it keep connection lingering
        response.destroy()
      })
      await new Promise((resolve) => server.listen(resolve))

      // @ts-ignore - this is actually what it returns on http
      const port = server.address().port
      const url = new URL(`http://localhost:${port}`)

      return new BlobsStorage({
        ...options,
        content,
        url,
        server,
      })
    } else {
      return new BlobsStorage({
        ...options,
        content,
        url: new URL(`http://localhost:8989`),
      })
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async deactivate() {
    const { server } = this
    if (server) {
      await new Promise((resolve, reject) => {
        // does not exist in node 16
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections()
        }

        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve(undefined)
          }
        })
      })
    }
  }

  /**
   * @param {Types.LegacyCarStoreBucketOptions & { server?: import('http').Server, url: URL, content: Map<string, Uint8Array> }} options
   */
  constructor({
    content,
    url,
    server,
    accessKeyId = 'id',
    secretAccessKey = 'secret',
    bucket = 'my-bucket',
    region = 'eu-central-1',
  }) {
    this.server = server
    this.baseURL = url
    this.accessKeyId = accessKeyId
    this.secretAccessKey = secretAccessKey
    this.bucket = bucket
    this.region = region
    this.content = content
  }

  /** @param {Types.MultihashDigest} digest */
  #bucketPath(digest) {
    return `/${this.bucket}/${contentKey(digest)}`
  }

  /** @param {Types.MultihashDigest} digest */
  async has(digest) {
    const key = this.#bucketPath(digest)
    if (!this.server) {
      const url = new URL(key, this.baseURL)
      const res = await fetch(url.toString())
      if (res.status === 404) return ok(false)
      if (!res.ok || !res.body) {
        throw new Error(
          `serverless blob storage failed to fetch from: ${url} status: ${res.status}`
        )
      }
      return ok(true)
    }
    return ok(this.content.has(key))
  }

  /** @param {Types.MultihashDigest} digest */
  async stream(digest) {
    const key = this.#bucketPath(digest)
    if (!this.server) {
      const url = new URL(key, this.baseURL)
      const res = await fetch(url.toString())
      if (res.status === 404) return error(new BlobNotFound(digest))
      if (!res.ok || !res.body) {
        throw new Error(
          `serverless blob storage failed to fetch from: ${url} status: ${res.status}`
        )
      }
      return ok(res.body)
    }

    const bytes = this.content.get(key)
    if (!bytes) return error(new BlobNotFound(digest))

    return ok(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      })
    )
  }

  /**
   * @param {Types.MultihashDigest} digest
   * @param {number} size
   * @param {number} expiresIn
   */
  async createUploadUrl(digest, size, expiresIn) {
    const { bucket, accessKeyId, secretAccessKey, region, baseURL } = this

    // sigv4
    const sig = new SigV4({
      accessKeyId,
      secretAccessKey,
      region,
    })

    const checksum = base64pad.baseEncode(digest.digest)
    const { search, hash } = sig.sign({
      key: contentKey(digest),
      checksum,
      bucket,
      expires: expiresIn,
    })

    const url = new URL(baseURL)
    url.search = search
    url.pathname = this.#bucketPath(digest)
    url.hash = hash
    url.searchParams.set(
      'X-Amz-SignedHeaders',
      ['content-length', 'host', 'x-amz-checksum-sha256'].join(';')
    )

    return {
      ok: {
        url,
        headers: {
          'x-amz-checksum-sha256': checksum,
          'content-length': String(size),
        },
      },
    }
  }

  /** @param {Types.MultihashDigest} digest */
  async createDownloadUrl(digest) {
    const url = new URL(this.#bucketPath(digest), this.baseURL)
    return ok(/** @type {Types.URI} */ (url.toString()))
  }
}
