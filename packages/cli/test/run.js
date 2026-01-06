#!/usr/bin/env node

/**
 * Test runner wrapper that ensures the process exits after tests complete.
 *
 * In Node.js 19+, server.close() doesn't automatically close keep-alive
 * connections, which can cause the process to hang after tests complete.
 * This wrapper ensures the process exits after tests finish.
 *
 * Strategy: Run entail with a global timeout. If tests take longer than
 * 10 minutes, something is definitely wrong. We parse the output to detect
 * test completion and exit code, then force exit.
 */

import { spawn } from 'node:child_process'

// Maximum time to wait for tests (10 minutes)
const TEST_TIMEOUT_MS = 10 * 60 * 1000

// Time to wait after tests complete before force exiting (5 seconds)
const POST_COMPLETE_WAIT_MS = 5 * 1000

let testsSummaryPrinted = false
let exitCode = 0
let forceExitTimer = null

// Find the entail bin.js path by looking in node_modules
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Go up to packages/cli then into node_modules/entail/src/bin.js
const entailBin = join(__dirname, '..', 'node_modules', 'entail', 'src', 'bin.js')

const child = spawn(
  process.execPath,
  [entailBin, '**/*.spec.js'],
  {
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['inherit', 'pipe', 'inherit'],
  }
)

child.stdout.on('data', (data) => {
  const text = data.toString()
  process.stdout.write(text)

  // Detect when tests are done by looking for the Duration line
  if (text.includes('Duration:')) {
    testsSummaryPrinted = true
    // Schedule a force exit shortly after tests complete
    // This gives time for cleanup but ensures we don't hang
    if (!forceExitTimer) {
      forceExitTimer = setTimeout(() => {
        console.log('\n[test/run.js] Tests completed. Force exiting to prevent hang.')
        process.exit(exitCode)
      }, POST_COMPLETE_WAIT_MS)
    }
  }

  // Check for failures
  if (text.includes('Failed:') && !text.includes('Failed:    0')) {
    exitCode = 1
  }
})

child.on('close', (code) => {
  if (forceExitTimer) clearTimeout(forceExitTimer)
  process.exit(code ?? exitCode)
})

child.on('error', (err) => {
  console.error('Failed to start test runner:', err)
  process.exit(1)
})

// Global timeout: if tests haven't finished in 10 minutes, something is very wrong
setTimeout(() => {
  console.error('\n[test/run.js] ERROR: Test timeout after 10 minutes. Force exiting.')
  process.exit(1)
}, TEST_TIMEOUT_MS)
