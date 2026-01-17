import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const cmd = args[0] || 'entail'
const cmdArgs = args.slice(1).length ? args.slice(1) : ['**/*.spec.js']

console.log(`Running tests with wrapper: ${cmd} ${cmdArgs.join(' ')}`)

const child = spawn(cmd, cmdArgs, {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: true
})

let output = ''

child.stdout.on('data', (data) => {
  process.stdout.write(data)
  output += data.toString()
  
  // Check for completion signals from Entail output
  if (output.includes('Duration:') || output.includes('Failed:')) {
    // Give it a moment to flush buffers
    setTimeout(() => {
      const failed = output.includes('Failed:') && !output.match(/Failed:\s+0/)
      const code = failed ? 1 : 0
      console.log(`\n[Wrapper] Test execution completed. Forcing exit with code ${code}.`)
      process.exit(code)
    }, 500)
  }
})

child.on('exit', (code) => {
  console.log(`\n[Wrapper] Child process exited with code ${code}`)
  process.exit(code)
})
