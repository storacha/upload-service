import { createServer } from 'node:http'
import * as Server from '@ucanto/server'
import { CAR } from '@ucanto/transport'
import * as Space from '@storacha/capabilities/space'

/**
 * Create mock KMS service with proper capability handlers
 *
 * @param {object} options
 * @param {string} options.mockPublicKey - Mock RSA public key in PEM format
 * @param {string} options.mockKeyReference - Mock KMS key reference
 * @param {string} [options.mockProvider] - Mock KMS provider
 * @param {string} [options.mockAlgorithm] - Mock algorithm
 * @param {Function} [options.onEncryptionSetup] - Optional callback for setup calls
 * @param {Function} [options.onKeyDecrypt] - Optional callback for decrypt calls
 */
export function createMockGatewayService(options) {
  const {
    mockPublicKey,
    mockKeyReference,
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
            keyReference: mockKeyReference,
            provider: mockProvider,
            algorithm: mockAlgorithm,
          })
        }),

        key: {
          decrypt: Server.provide(Space.KeyDecrypt, async (input) => {
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
            if (!input.capability.nb.encryptedSymmetricKey) {
              return Server.error({
                name: 'MissingKey',
                message: 'encryptedSymmetricKey is required',
              })
            }

            // For testing purposes, "decrypt" by base64 decoding the input
            // In real implementation, this would call Google KMS
            const mockDecryptedKey = input.capability.nb.encryptedSymmetricKey

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
 * Create a mock private gateway HTTP server
 *
 * @param {object} service - The service object with capability handlers
 * @param {*} gatewayDID - The gateway DID keypair
 * @param {number} port - The port to listen on
 */
export function createMockGatewayServer(service, gatewayDID, port) {
  const ucantoServer = Server.create({
    id: gatewayDID,
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
        resolve({
          server: httpServer,
          url: `http://localhost:${port}`,
          close: () => new Promise((resolve) => httpServer.close(resolve)),
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
