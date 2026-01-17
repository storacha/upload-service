import { unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Playwright global teardown - stops the secure HTTPS server after all tests.
 */
export default async function globalTeardown() {
  console.log('[Global Teardown] Stopping secure HTTPS server...')

  // Get server reference from global
  const serverInfo = globalThis.__SECURE_SERVER__

  if (serverInfo) {
    try {
      // Force close all connections immediately
      if (serverInfo.server) {
        // Destroy all active sockets
        if (serverInfo.server.closeAllConnections) {
          serverInfo.server.closeAllConnections()
        }

        // Force unref to allow process to exit
        if (serverInfo.server.unref) {
          serverInfo.server.unref()
        }
      }

      await serverInfo.close()
      console.log('[Global Teardown] Server stopped successfully')
    } catch (error) {
      console.error('[Global Teardown] Error stopping server:', error)
    }
  } else {
    console.warn('[Global Teardown] No server reference found')
  }

  // Clean up temp file
  const serverInfoPath = join(__dirname, '.server-info.json')
  if (existsSync(serverInfoPath)) {
    try {
      unlinkSync(serverInfoPath)
    } catch {
      // Ignore cleanup errors
    }
  }

  console.log('[Global Teardown] Cleanup complete')

  // Force exit in CI to prevent hangs
  if (process.env.CI) {
    console.log('[Global Teardown] CI mode - forcing exit')
    // eslint-disable-next-line no-process-exit
    process.exit(0)
