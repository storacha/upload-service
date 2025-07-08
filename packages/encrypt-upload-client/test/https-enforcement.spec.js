import assert from 'node:assert'
import { describe, test } from 'node:test'
import { KMSCryptoAdapter } from '../src/crypto/adapters/kms-crypto-adapter.js'
import { BrowserAesCtrCrypto } from '../src/crypto/symmetric/browser-aes-ctr-crypto.js'

await describe('HTTPS Enforcement', async () => {
  await describe('KMSCryptoAdapter Constructor', async () => {
    await test('should accept valid HTTPS URL as string', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      // Should not throw
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://freeway.dag.haus',
        'did:web:freeway.dag.haus'
      )

      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create adapter successfully'
      )
      assert.strictEqual(
        adapter.privateGatewayURL.protocol,
        'https:',
        'Should store HTTPS protocol'
      )
      assert.strictEqual(
        adapter.privateGatewayURL.toString(),
        'https://freeway.dag.haus/',
        'Should store correct URL'
      )
    })

    await test('should accept valid HTTPS URL object', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const httpsURL = new URL('https://example.com:8443/path')

      // Should not throw
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        httpsURL,
        'did:web:example.com'
      )

      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should create adapter successfully'
      )
      assert.strictEqual(
        adapter.privateGatewayURL.protocol,
        'https:',
        'Should store HTTPS protocol'
      )
      assert.strictEqual(
        adapter.privateGatewayURL.toString(),
        'https://example.com:8443/path',
        'Should preserve URL structure'
      )
    })

    await test('should reject HTTP URL string', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      assert.throws(
        () =>
          new KMSCryptoAdapter(
            symmetricCrypto,
            'http://insecure.example.com',
            'did:web:example.com'
          ),
        /Private gateway must use HTTPS protocol for security.*Received: http:/,
        'Should reject HTTP protocol'
      )
    })

    await test('should reject HTTP URL object', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()
      const httpURL = new URL('http://insecure.example.com')

      assert.throws(
        () =>
          new KMSCryptoAdapter(symmetricCrypto, httpURL, 'did:web:example.com'),
        /Private gateway must use HTTPS protocol for security.*Received: http:/,
        'Should reject HTTP URL object'
      )
    })

    await test('should reject other protocols', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      const protocolTestCases = [
        'ftp://example.com',
        'ws://example.com',
        'file://example.com',
        'data:text/plain;base64,SGVsbG8=',
      ]

      for (const testURL of protocolTestCases) {
        assert.throws(
          () =>
            new KMSCryptoAdapter(
              symmetricCrypto,
              testURL,
              'did:web:example.com'
            ),
          /Private gateway must use HTTPS protocol for security/,
          `Should reject protocol: ${testURL}`
        )
      }
    })

    await test('should provide helpful error message', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      try {
        new KMSCryptoAdapter(
          symmetricCrypto,
          'http://example.com',
          'did:web:example.com'
        )
        assert.fail('Should have thrown an error')
      } catch (error) {
        assert(error instanceof Error, 'Should throw Error instance')
        assert(
          error.message.includes('Private gateway must use HTTPS protocol'),
          'Should include main error message'
        )
        assert(
          error.message.includes('Received: http:'),
          'Should include received protocol'
        )
        assert(
          error.message.includes('https://your-gateway.com'),
          'Should include example of correct format'
        )
      }
    })

    await test('should handle localhost development URLs correctly', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      // Even localhost should require HTTPS for consistency
      assert.throws(
        () =>
          new KMSCryptoAdapter(
            symmetricCrypto,
            'http://localhost:3000',
            'did:web:localhost'
          ),
        /Private gateway must use HTTPS protocol for security.*Received: http:/,
        'Should reject HTTP even for localhost'
      )

      // But HTTPS localhost should work
      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://localhost:3000',
        'did:web:localhost'
      )

      assert(
        adapter instanceof KMSCryptoAdapter,
        'Should accept HTTPS localhost'
      )
    })

    await test('should handle invalid URL strings gracefully', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      assert.throws(
        () =>
          new KMSCryptoAdapter(
            symmetricCrypto,
            'not-a-valid-url',
            'did:web:example.com'
          ),
        /Invalid URL/,
        'Should throw URL parsing error for invalid URLs'
      )
    })

    await test('should preserve all adapter functionality after HTTPS validation', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'https://freeway.dag.haus',
        'did:web:freeway.dag.haus'
      )

      // Verify all expected methods exist
      assert.strictEqual(
        typeof adapter.encryptStream,
        'function',
        'Should have encryptStream method'
      )
      assert.strictEqual(
        typeof adapter.decryptStream,
        'function',
        'Should have decryptStream method'
      )
      assert.strictEqual(
        typeof adapter.encryptSymmetricKey,
        'function',
        'Should have encryptSymmetricKey method'
      )
      assert.strictEqual(
        typeof adapter.decryptSymmetricKey,
        'function',
        'Should have decryptSymmetricKey method'
      )
      assert.strictEqual(
        typeof adapter.extractEncryptedMetadata,
        'function',
        'Should have extractEncryptedMetadata method'
      )
      assert.strictEqual(
        typeof adapter.getEncryptedKey,
        'function',
        'Should have getEncryptedKey method'
      )
      assert.strictEqual(
        typeof adapter.encodeMetadata,
        'function',
        'Should have encodeMetadata method'
      )

      // Verify adapter properties are set correctly
      assert(
        adapter.symmetricCrypto === symmetricCrypto,
        'Should store symmetric crypto reference'
      )
      assert.strictEqual(
        adapter.privateGatewayDID.did(),
        'did:web:freeway.dag.haus',
        'Should store gateway DID'
      )
    })
  })

  await describe('Secure by Default Principle', async () => {
    await test('should demonstrate secure by default - HTTPS is automatically used', async () => {
      const symmetricCrypto = new BrowserAesCtrCrypto()

      // All of these should work without any special configuration
      const validHttpsUrls = [
        'https://gateway.example.com',
        'https://localhost:8080',
        'https://192.168.1.100:3000',
        'https://api.storacha.network:443/v1',
      ]

      for (const url of validHttpsUrls) {
        const adapter = new KMSCryptoAdapter(
          symmetricCrypto,
          url,
          'did:web:example.com'
        )

        assert.strictEqual(
          adapter.privateGatewayURL.protocol,
          'https:',
          `Should store HTTPS protocol for URL: ${url}`
        )
      }
    })

    await test('should require explicit insecure configuration to bypass HTTPS', async () => {
      // This demonstrates that HTTP is never accidentally allowed
      // If someone really needs HTTP (like for testing), they would need to
      // modify our security validation code intentionally

      const symmetricCrypto = new BrowserAesCtrCrypto()
      const httpUrls = [
        'http://example.com',
        'http://localhost:3000',
        'http://192.168.1.100:8080',
      ]

      for (const url of httpUrls) {
        assert.throws(
          () =>
            new KMSCryptoAdapter(symmetricCrypto, url, 'did:web:example.com'),
          /Private gateway must use HTTPS protocol for security/,
          `Should reject HTTP URL: ${url}`
        )
      }
    })

    await test('should allow HTTP for testing when explicitly enabled', async () => {
      // This demonstrates the testing escape hatch
      const symmetricCrypto = new BrowserAesCtrCrypto()

      const adapter = new KMSCryptoAdapter(
        symmetricCrypto,
        'http://localhost:8080',
        'did:web:localhost',
        { allowInsecureHttp: true } // Explicit testing option
      )

      assert.strictEqual(
        adapter.privateGatewayURL.protocol,
        'http:',
        'Should allow HTTP when explicitly enabled for testing'
      )
      assert.strictEqual(
        adapter.privateGatewayURL.toString(),
        'http://localhost:8080/',
        'Should preserve HTTP URL when testing option is enabled'
      )
    })
  })
})
