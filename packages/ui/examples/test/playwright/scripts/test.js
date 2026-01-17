/* eslint-disable */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'

console.log('[Wrapper] Starting Playwright tests for UI Examples...')

const args = process.argv.slice(2)
const cmd = 'npx'
const cmdArgs = ['playwright', 'test', ...args]

const child = spawn(cmd, cmdArgs, {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: false,
  env: { ...process.env, CI: 'true' }
})

let output = ''
let exited = false

const forceExit = (code) => {
    if (exited) return
    exited = true
    
    // Kill the zombie server on port 1337 if it exists
    try {
        execSync('fuser -k 1337/tcp')
    } catch (e) {}

    console.log(`\n[Wrapper] Exiting with code ${code}.`)
    try { child.kill() } catch {}
    process.exit(code)
}

child.stdout.on('data', (data) => {
  process.stdout.write(data)
  output += data.toString()
  
  if (output.match(/(\d+ passed)|(\d+ failed)/)) {
     setTimeout(() => {
        const failed = output.includes('failed')
        forceExit(failed ? 1 : 0)
    }, 1000)
  }
})

child.on('exit', (code) => {
  if (!exited) {
    console.log(`\n[Wrapper] Process exited with code ${code}`)
    forceExit(code)
  }
})
