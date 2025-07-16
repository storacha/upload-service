import { createServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Create a secure HTTPS server for Playwright crypto testing
 *
 * @param {object} options
 * @param {number} [options.port=8443] - The port to listen on
 * @param {string} [options.certPath] - Path to SSL certificate
 * @param {string} [options.keyPath] - Path to SSL private key
 */
export function createSecureCryptoServer(options = {}) {
  const {
    port = 8443,
    certPath = join(__dirname, 'cert.crt'),
    keyPath = join(__dirname, 'cert.key'),
  } = options

  // Load SSL certificates
  const sslOptions = {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  }

  // Read the crypto implementation source
  const cryptoSourcePath = join(
    __dirname,
    '../../../src/crypto/symmetric/generic-aes-ctr-streaming-crypto.js'
  )
  const cryptoSource = readFileSync(cryptoSourcePath, 'utf8')

  // Create the test page HTML
  function createTestPageHtml() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Secure Crypto Test Page</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>Secure Cross-Environment Crypto Testing</h1>
    <p>This page is served over HTTPS to enable Web Crypto API in all browsers.</p>
    <div id="status">Loading crypto implementation...</div>
    
    <script type="module">
        try {
            // Check for Web Crypto API availability
            window.hasCrypto = typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
            
            const statusDiv = document.getElementById('status');
            
            if (window.hasCrypto) {
                statusDiv.innerHTML = 'Web Crypto API available!';
                statusDiv.style.color = 'green';
                
                // Inline the crypto implementation with proper browser compatibility
                ${cryptoSource
                  .replace(
                    "import * as Type from '../../types.js'",
                    '// Types not needed for browser test'
                  )
                  .replace(
                    'export class GenericAesCtrStreamingCrypto',
                    'class GenericAesCtrStreamingCrypto'
                  )}
                
                // Make it available globally for Playwright
                window.GenericAesCtrStreamingCrypto = GenericAesCtrStreamingCrypto;
                
                console.log('GenericAesCtrStreamingCrypto loaded successfully');
            } else {
                statusDiv.innerHTML = 'Web Crypto API not available';
                statusDiv.style.color = 'red';
                
                // Create a mock for browsers without crypto support
                window.GenericAesCtrStreamingCrypto = class MockCrypto {
                    async encryptStream() {
                        throw new Error('Web Crypto API not available in this context');
                    }
                };
                
                console.warn('Web Crypto API not available, using mock implementation');
            }
            
            // Helper functions for the browser tests
            window.createTestBlob = function(sizeMB) {
                const sizeBytes = sizeMB * 1024 * 1024;
                const data = new Uint8Array(sizeBytes);
                
                // Fill with predictable pattern for testing
                for (let i = 0; i < sizeBytes; i++) {
                    data[i] = i % 256;
                }
                
                return new Blob([data]);
            };
            
            window.streamToUint8Array = async function(stream) {
                const reader = stream.getReader();
                const chunks = [];
                
                try {
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                    }
                } finally {
                    reader.releaseLock();
                }
                
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }
                
                return result;
            };

            // Signal that the page is ready for testing
            window.cryptoReady = true;
            window.serverInfo = {
                protocol: 'https',
                host: window.location.host,
                timestamp: new Date().toISOString()
            };
            
            console.log('Secure crypto test page ready for Playwright testing');
            
        } catch (error) {
            console.error('Error setting up crypto test page:', error);
            document.getElementById('status').innerHTML = 'Setup error: ' + error.message;
            document.getElementById('status').style.color = 'red';
            
            // Still signal ready so tests can handle the error
            window.cryptoReady = true;
            window.setupError = error.message;
        }
    </script>
</body>
</html>`
  }

  // Create HTTPS server
  const server = createServer(sslOptions, (req, res) => {
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      return res.end()
    }

    // Route handling
    const url = new URL(req.url || '/', `https://${req.headers.host}`)

    switch (url.pathname) {
      case '/':
      case '/crypto-test':
        // Serve the main crypto test page
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.writeHead(200)
        res.end(createTestPageHtml())
        break

      case '/health':
        // Health check endpoint
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(200)
        res.end(
          JSON.stringify({
            status: 'ok',
            service: 'secure-crypto-test-server',
            timestamp: new Date().toISOString(),
            crypto: {
              available: typeof globalThis.crypto !== 'undefined',
              subtle: typeof globalThis.crypto?.subtle !== 'undefined',
            },
          })
        )
        break

      default:
        // 404 for unknown routes
        res.writeHead(404)
        res.end('<h1>404 Not Found</h1><p>Path: ' + url.pathname + '</p>')
        break
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(port, (/** @type {Error | undefined} */ err) => {
      if (err) {
        reject(err)
      } else {
        resolve({
          server,
          url: `https://localhost:${port}`,
          cryptoTestUrl: `https://localhost:${port}/crypto-test`,
          healthUrl: `https://localhost:${port}/health`,
          port,
          close: () => new Promise((resolve) => server.close(resolve)),
        })
      }
    })
  })
}

/**
 * Helper to create and start a secure server for testing
 *
 * @param {number} [port=8443] - Port to use
 * @returns {Promise<{server: *, url: string, cryptoTestUrl: string, close: Function}>}
 */
export async function startSecureCryptoTestServer(port = 8443) {
  console.log(`Starting secure crypto test server on port ${port}...`)

  try {
    const serverInfo = await createSecureCryptoServer({ port })
    console.log(`Secure server running at ${serverInfo.url}`)
    console.log(`Crypto test page: ${serverInfo.cryptoTestUrl}`)
    console.log(`Health check: ${serverInfo.healthUrl}`)

    return serverInfo
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `Failed to start secure server on port ${port}:`,
      errorMessage
    )
    throw error
  }
}

/**
 * Gracefully stop the server
 *
 * @param {{server: *, url: string, cryptoTestUrl: string, healthUrl: string, port: number, close: Function}} serverInfo - Server info returned from startSecureCryptoTestServer
 */
export async function stopSecureCryptoTestServer(serverInfo) {
  console.log('Stopping secure crypto test server...')

  try {
    await serverInfo.close()
    console.log('Secure server stopped successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error stopping secure server:', errorMessage)
    throw error
  }
}
