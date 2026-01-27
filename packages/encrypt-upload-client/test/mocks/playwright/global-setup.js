import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startSecureCryptoTestServer } from './secure-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Playwright global setup - starts the secure HTTPS server before all tests.
 * The server URL is stored in a file for tests to read.
 */
export default async function globalSetup() {
  console.log('[Global Setup] Starting secure HTTPS server...')

  const serverInfo = await startSecureCryptoTestServer(8443)

  // Store server info in a temp file for tests to access
  const serverInfoPath = join(__dirname, '.server-info.json')
  writeFileSync(
    serverInfoPath,
    JSON.stringify({
      url: serverInfo.url,
      cryptoTestUrl: serverInfo.cryptoTestUrl,
      healthUrl: serverInfo.healthUrl,
      port: serverInfo.port,
    })
  )

  // Store server reference globally for teardown
  globalThis.__SECURE_SERVER__ = serverInfo

  console.log(`[Global Setup] Server ready at ${serverInfo.url}`)
}
