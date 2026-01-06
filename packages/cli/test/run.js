#!/usr/bin/env node

/**
 * Test runner wrapper that ensures the process exits after tests complete.
 *
 * In Node.js 19+, server.close() doesn't automatically close keep-alive
 * connections, which can cause the process to hang after tests complete.
 * This wrapper ensures the process exits after tests finish.
 */

import { spawn } from 'node:child_process'

// Track if tests have printed their summary
let testsSummaryPrinted = false
let exitCode = 0

const child = spawn('npx', ['entail', '**/*.spec.js'], {
  cwd: process.cwd(),
  env: { ...process.env, FORCE_COLOR: '1' },
  shell: true,
  stdio: ['inherit', 'pipe', 'inherit'],
})

child.stdout.on('data', (data) => {
  const text = data.toString()
  process.stdout.write(text)

  // Detect when tests are done by looking for the Duration line
  if (text.includes('Duration:')) {
    testsSummaryPrinted = true
    // Check if any tests failed
    if (text.includes('Passed:') && !text.includes('Passed:    0')) {
      // Tests ran, check for failures in the output
    }
  }

  // Check for failures
  if (text.includes('Failed:') && !text.includes('Failed:    0')) {
    exitCode = 1
  }
})

child.on('close', (code) => {
  process.exit(code ?? exitCode)
})

child.on('error', (err) => {
  console.error('Failed to start test runner:', err)
  process.exit(1)
})

// Safety timeout: if tests printed summary but process hasn't exited after 30s, force exit
setInterval(() => {
  if (testsSummaryPrinted) {
    console.log('\n[test/run.js] Tests completed but process did not exit. Force exiting...')
    process.exit(exitCode)
  }
}, 30000)
