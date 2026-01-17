/* eslint-disable */
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const targetCmd = args[0] || 'entail'
const targetArgs = args.slice(1).length ? args.slice(1) : ['**/*.spec.js']

const child = spawn('npx', [targetCmd, ...targetArgs], {
  stdio: 'inherit',
  env: process.env,
})

let exited = false
const timeout = setTimeout(() => {
  if (!exited) {
    console.error('\n[Wrapper] Timeout - forcing exit')
    child.kill('SIGKILL')
    process.exit(1)
  }
}, 5 * 60 * 1000)

child.on('exit', (code) => {
  exited = true
  clearTimeout(timeout)
  process.exit(code || 0)
})
