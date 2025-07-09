import { test, expect } from '@playwright/test'
import { GenericAesCtrStreamingCrypto } from '../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
import {
  startSecureCryptoTestServer,
  stopSecureCryptoTestServer,
} from './mocks/playwright/secure-server.js'
import { streamToUint8Array } from './helpers/test-file-utils.js'

test.describe('Secure Cross-Environment Crypto with HTTPS Server', () => {
  /** @type {any} */
  let serverInfo

  test.beforeAll(async () => {
    // Start the secure HTTPS server before tests
    console.log(
      'Starting secure HTTPS server for cross-environment crypto testing...'
    )
    serverInfo = await startSecureCryptoTestServer(8443)
    console.log(`Secure server ready at ${serverInfo.url}`)
  })

  test.afterAll(async () => {
    // Stop the secure server after tests
    if (serverInfo) {
      console.log('Stopping secure HTTPS server...')
      await stopSecureCryptoTestServer(serverInfo)
      console.log('Secure server stopped')
    }
  })

  test('should encrypt in browser and decrypt in Node.js using HTTPS', async ({
    page,
    browserName,
  }) => {
    console.log(`Testing ${browserName} with secure HTTPS server...`)

    // Navigate to our secure crypto test page
    await page.goto(serverInfo.cryptoTestUrl, {
      waitUntil: 'networkidle',
      timeout: 10000,
    })

    // Wait for the crypto implementation to be ready
    await page.waitForFunction(() => window.cryptoReady === true, {
      timeout: 5000,
    })

    // Check if crypto is available in this browser
    const hasCrypto = await page.evaluate(() => window.hasCrypto)

    if (!hasCrypto) {
      console.warn(
        `Web Crypto API not available in ${browserName}, skipping test`
      )
      test.skip()
    }

    console.log(`Web Crypto API available in ${browserName}`)

    // Step 1: Encrypt data in browser
    console.log('Step 1: Encrypting data in browser...')
    const browserResult = await page.evaluate(async () => {
      const crypto = new window.GenericAesCtrStreamingCrypto()
      const testBlob = window.createTestBlob(0.1) // 100KB test file

      const { key, iv, encryptedStream } = await crypto.encryptStream(testBlob)
      const encryptedBytes = await window.streamToUint8Array(encryptedStream)

      return {
        key: Array.from(key), // Convert to array for serialization
        iv: Array.from(iv),
        encryptedBytes: Array.from(encryptedBytes),
        originalSize: testBlob.size,
      }
    })

    console.log(
      `Browser encryption completed: ${browserResult.encryptedBytes.length} bytes encrypted`
    )

    // Step 2: Decrypt in Node.js using the same implementation
    console.log('Step 2: Decrypting in Node.js...')
    const nodeCrypto = new GenericAesCtrStreamingCrypto()

    // Convert arrays back to Uint8Arrays
    const key = new Uint8Array(browserResult.key)
    const iv = new Uint8Array(browserResult.iv)
    const encryptedData = new Uint8Array(browserResult.encryptedBytes)

    // Create a ReadableStream from the encrypted data for Node.js
    const encryptedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encryptedData)
        controller.close()
      },
    })

    const decryptedStream = await nodeCrypto.decryptStream(
      encryptedStream,
      key,
      iv
    )
    const decryptedBytes = await streamToUint8Array(decryptedStream)

    console.log(
      `Node.js decryption completed: ${decryptedBytes.length} bytes decrypted`
    )

    // Step 3: Verify the decrypted data matches the original pattern
    console.log('Step 3: Verifying cross-environment compatibility...')

    // The original test blob has a predictable pattern (i % 256)
    expect(decryptedBytes.length).toBe(browserResult.originalSize)

    // Verify the pattern
    for (let i = 0; i < Math.min(1000, decryptedBytes.length); i++) {
      expect(decryptedBytes[i]).toBe(i % 256)
    }

    console.log('Cross-environment encryption/decryption successful!')
    console.log(`   Browser (${browserName}) → Node.js compatibility verified`)
    console.log(`   Original size: ${browserResult.originalSize} bytes`)
    console.log(
      `   Encrypted size: ${browserResult.encryptedBytes.length} bytes`
    )
    console.log(`   Decrypted size: ${decryptedBytes.length} bytes`)
  })

  test('should decrypt in browser data encrypted in Node.js using HTTPS', async ({
    page,
    browserName,
  }) => {
    console.log(`Testing Node.js → ${browserName} with secure HTTPS server...`)

    // Navigate to our secure crypto test page
    await page.goto(serverInfo.cryptoTestUrl, {
      waitUntil: 'networkidle',
      timeout: 10000,
    })

    // Wait for the crypto implementation to be ready
    await page.waitForFunction(() => window.cryptoReady === true, {
      timeout: 5000,
    })

    // Check if crypto is available in this browser
    const hasCrypto = await page.evaluate(() => window.hasCrypto)

    if (!hasCrypto) {
      console.warn(
        `Web Crypto API not available in ${browserName}, skipping test`
      )
      test.skip()
    }

    // Step 1: Encrypt data in Node.js
    console.log('Step 1: Encrypting data in Node.js...')
    const nodeCrypto = new GenericAesCtrStreamingCrypto()
    const testData = new Uint8Array(102400) // 100KB

    // Fill with predictable pattern
    for (let i = 0; i < testData.length; i++) {
      testData[i] = i % 256
    }

    const testBlob = new Blob([testData])
    const { key, iv, encryptedStream } = await nodeCrypto.encryptStream(
      testBlob
    )
    const encryptedBytes = await streamToUint8Array(encryptedStream)

    console.log(
      `Node.js encryption completed: ${encryptedBytes.length} bytes encrypted`
    )

    // Step 2: Decrypt in browser
    console.log('Step 2: Decrypting in browser...')
    const decryptedBytes = await page.evaluate(
      async (data) => {
        // @ts-expect-error
        const crypto = new window.GenericAesCtrStreamingCrypto()

        // Convert arrays back to Uint8Arrays
        const key = new Uint8Array(data.key)
        const iv = new Uint8Array(data.iv)
        const encryptedData = new Uint8Array(data.encryptedBytes)

        // Create a ReadableStream from the encrypted data
        const encryptedStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encryptedData)
            controller.close()
          },
        })

        const decryptedStream = await crypto.decryptStream(
          encryptedStream,
          key,
          iv
        )
        // @ts-expect-error
        const decryptedBytes = await window.streamToUint8Array(decryptedStream)

        return Array.from(decryptedBytes) // Convert for serialization
      },
      {
        key: Array.from(key),
        iv: Array.from(iv),
        encryptedBytes: Array.from(encryptedBytes),
      }
    )

    console.log(
      `Browser decryption completed: ${decryptedBytes.length} bytes decrypted`
    )

    // Step 3: Verify the decrypted data matches the original pattern
    console.log('Step 3: Verifying cross-environment compatibility...')

    expect(decryptedBytes.length).toBe(testData.length)

    // Verify the pattern
    for (let i = 0; i < Math.min(1000, decryptedBytes.length); i++) {
      expect(decryptedBytes[i]).toBe(i % 256)
    }

    console.log('Cross-environment encryption/decryption successful!')
    console.log(`   Node.js → Browser (${browserName}) compatibility verified`)
    console.log(`   Original size: ${testData.length} bytes`)
    console.log(`   Encrypted size: ${encryptedBytes.length} bytes`)
    console.log(`   Decrypted size: ${decryptedBytes.length} bytes`)
  })

  test('should verify server health and crypto availability', async ({
    page,
  }) => {
    console.log('Testing server health and crypto availability...')

    // Test the health endpoint
    const healthResponse = await page.goto(serverInfo.healthUrl)
    expect(healthResponse).not.toBeNull()
    // @ts-expect-error
    expect(healthResponse.status()).toBe(200)

    // @ts-expect-error
    const healthData = await healthResponse.json()
    expect(healthData.status).toBe('ok')
    expect(healthData.service).toBe('secure-crypto-test-server')

    console.log('Server health check passed')
    console.log(`   Service: ${healthData.service}`)
    console.log(`   Timestamp: ${healthData.timestamp}`)
    console.log(`   Node.js Crypto Available: ${healthData.crypto.available}`)
    console.log(`   Node.js Crypto Subtle: ${healthData.crypto.subtle}`)
  })
})
