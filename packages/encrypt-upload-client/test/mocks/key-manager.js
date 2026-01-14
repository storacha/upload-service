import { createServer } from 'node:http'
import * as Server from '@ucanto/server'
import { CAR } from '@ucanto/transport'
import * as Space from '@storacha/capabilities/space'
import { base64 } from 'multiformats/bases/base64'

/**
 * Create mock KMS service with proper capability handlers
 *
 * @param {object} options
 * @param {string} options.mockPublicKey - Mock RSA public key in PEM format
 * @param {string} [options.mockProvider] - Mock KMS provider
 * @param {string} [options.mockAlgorithm] - Mock algorithm
 * @param {Function} [options.onEncryptionSetup] - Optional callback for setup calls
 * @param {Function} [options.onKeyDecrypt] - Optional callback for decrypt calls
 */
export function createMockKeyManagerService(options) {
  const {
    mockPublicKey,
    mockProvider = 'google-kms',
    mockAlgorithm = 'RSA-OAEP-2048-SHA256',
    onEncryptionSetup,
    onKeyDecrypt,
  } = options

  return {
    space: {
      encryption: {
        setup: Server.provide(Space.EncryptionSetup, async (input) => {
          // Call optional callback for testing
          if (onEncryptionSetup) {
            onEncryptionSetup(input)
          }

          // Validate the space DID format
          if (!input.capability.with.startsWith('did:key:')) {
            return Server.error({
              name: 'InvalidSpace',
              message: 'Space DID must be a did:key',
            })
          }

          // Return mock RSA public key and metadata
          return Server.ok({
            publicKey: mockPublicKey,
            provider: mockProvider,
            algorithm: mockAlgorithm,
          })
        }),

        key: {
          decrypt: Server.provide(Space.EncryptionKeyDecrypt, async (input) => {
            // Call optional callback for testing
            if (onKeyDecrypt) {
              onKeyDecrypt(input)
            }

            // Validate the space DID
            if (!input.capability.with.startsWith('did:key:')) {
              return Server.error({
                name: 'InvalidSpace',
                message: 'Space DID must be a did:key',
              })
            }

            // Validate encrypted key is provided
            if (!input.capability.nb.key) {
              return Server.error({
                name: 'KeyNotFound',
                message: 'key is required',
              })
            }

            // For testing purposes, "decrypt" by converting bytes back to base64 string
            // In real implementation, this would call Google KMS
            const keyBytes = input.capability.nb.key
            // No base64 decode here, just return the bytes as base64 string for mock
            const mockDecryptedKey = base64.encode(keyBytes)

            return Server.ok({
              decryptedSymmetricKey: mockDecryptedKey,
            })
          }),
        },
      },
    },
  }
}

/**
 * Create a mock key manager service server
 *
 * @param {object} service - The service object with capability handlers
 * @param {*} keyManagerServiceDID - The key manager service DID keypair
 * @param {number} port - The port to listen on
 * @param {boolean} [useHttps] - Whether to use HTTPS URLs (testing HTTPS scenarios)
 */
export function createMockKeyManagerServer(
  service,
  keyManagerServiceDID,
  port,
  useHttps = false
) {
  const ucantoServer = Server.create({
    id: keyManagerServiceDID,
    service,
    codec: CAR.inbound,
    validateAuthorization: () => ({ ok: {} }), // Skip auth validation for tests
  })

  const httpServer = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    if (req.method === 'OPTIONS') return res.end()

    if (req.method === 'POST') {
      const bodyBuffer = Buffer.concat(await collect(req))

      const reqHeaders = /** @type {Record<string, string>} */ (
        Object.fromEntries(Object.entries(req.headers))
      )

      const { headers, body, status } = await ucantoServer.request({
        body: new Uint8Array(
          bodyBuffer.buffer,
          bodyBuffer.byteOffset,
          bodyBuffer.byteLength
        ),
        headers: reqHeaders,
      })

      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value)
      }
      res.writeHead(status ?? 200)
      res.end(body)
    } else {
      res.end()
    }
  })

  return new Promise((resolve, reject) => {
    httpServer.listen(port, (/** @type {Error | undefined} */ err) => {
      if (err) {
        reject(err)
      } else {
        const protocol = useHttps ? 'https' : 'http'
        resolve({
          server: httpServer,
          url: `${protocol}://localhost:${port}`,
          close: () => {
            if (httpServer.closeAllConnections) {
              httpServer.closeAllConnections()
            }
            return new Promise((resolve) => httpServer.close(resolve))
          },
        })
      }
    })
  })
}

/** @param {import('node:stream').Readable} stream */
const collect = (stream) => {
  return /** @type {Promise<Buffer[]>} */ (
    new Promise((resolve, reject) => {
      const chunks = /** @type {Buffer[]} */ ([])
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', (err) => reject(err))
      stream.on('end', () => resolve(chunks))
    })
  )
}
