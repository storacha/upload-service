#!/usr/bin/env node

/**
 * Test runner wrapper that ensures the process exits after tests complete.
 *
 * In Node.js 19+, server.close() doesn't automatically close keep-alive
 * connections, which can cause the process to hang after tests complete.
 * This wrapper ensures the process exits after a short grace period.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = join(__dirname, '..')

// Run entail
const child = spawn('npx', ['entail', '**/*.spec.js'], {
  cwd,
  stdio: 'inherit',
  shell: true,
})

child.on('close', (code) => {
  // Give a short grace period for any cleanup, then force exit
  setTimeout(() => {
    process.exit(code ?? 0)
  }, 1000)
})

child.on('error', (err) => {
  console.error('Failed to start test runner:', err)
  process.exit(1)
})
