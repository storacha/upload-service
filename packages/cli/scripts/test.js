/* eslint-disable */
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const cmd = 'npx'
const targetCmd = args[0] || 'entail'
const targetArgs = args.slice(1).length ? args.slice(1) : ['**/*.spec.js']
const cmdArgs = [targetCmd, ...targetArgs]

console.log(`[Wrapper] Running: ${cmd} ${cmdArgs.join(' ')}`)

const child = spawn(cmd, cmdArgs, {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: false, 
  env: process.env
})

let output = ''
let exited = false

const forceExit = (code) => {
    if (exited) return
    exited = true
    console.log(`\n[Wrapper] Exiting with code ${code}.`)
    try { child.kill() } catch {} 
    process.exit(code)
}

child.stdout.on('data', (data) => {
  process.stdout.write(data)
  output += data.toString()
  
  if (output.includes('Duration:') || output.includes('Failed:')) {
    setTimeout(() => {
      const failed = output.includes('Failed:') && !output.match(/Failed:\s+0/)
      forceExit(failed ? 1 : 0)
    }, 1000) 
  }
})

child.on('exit', (code) => {
  if (!exited) {
      console.log(`\n[Wrapper] Child process finished with code ${code}.`)
      forceExit(code)
  }
})
