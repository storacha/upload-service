#!/usr/bin/env node

/**
 * Simple build test to verify package structure
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('🧪 Testing Storacha UI Package Structure\n')

// Test 1: Package files exist
console.log('1. Testing package files...')
const requiredFiles = [
  'package.json',
  'src/index.ts',
  'tsconfig.json',
  'packages/core/package.json',
  'packages/react/package.json',
  'packages/tailwind/package.json',
  'packages/theme/package.json',
  'packages/react/src/components/index.ts',
  'packages/react/src/components/Authenticator.tsx',
  'packages/react/src/components/Uploader.tsx',
]

let filesOk = true
requiredFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    console.log('  ✅', file)
  } else {
    console.log('  ❌', file, '(missing)')
    filesOk = false
  }
})

// Test 2: Package.json exports
console.log('\n2. Testing package.json exports...')
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const requiredExports = ['.', './core', './react', './tailwind', './theme']

  let exportsOk = true
  requiredExports.forEach((exp) => {
    if (pkg.exports && pkg.exports[exp]) {
      console.log('  ✅ Export:', exp)
    } else {
      console.log('  ❌ Missing export:', exp)
      exportsOk = false
    }
  })

  if (!exportsOk) filesOk = false
} catch (err) {
  console.log('  ❌ Error reading package.json:', err.message)
  filesOk = false
}

// Test 3: Module loading
console.log('\n3. Testing module loading...')
try {
  // Note: Tailwind plugin uses CommonJS, so we'll just check file exists
  if (fs.existsSync('./packages/tailwind/index.js')) {
    console.log('  ✅ Tailwind plugin file exists')
  } else {
    console.log('  ❌ Tailwind plugin file missing')
    filesOk = false
  }
} catch (err) {
  console.log('  ❌ Tailwind plugin error:', err.message)
  filesOk = false
}

// Test 4: Component structure
console.log('\n4. Testing component structure...')
try {
  const componentIndex = fs.readFileSync(
    'packages/react/src/components/index.ts',
    'utf8'
  )
  if (
    componentIndex.includes('Authenticator') &&
    componentIndex.includes('Uploader')
  ) {
    console.log('  ✅ Component exports found')
  } else {
    console.log('  ❌ Component exports missing')
    filesOk = false
  }
} catch (err) {
  console.log('  ❌ Component index error:', err.message)
  filesOk = false
}

// Final result
console.log('\n' + '='.repeat(50))
if (filesOk) {
  console.log('🎉 All tests passed! Package structure is correct.')
  console.log('\n📦 Ready for:')
  console.log('   • npm install @storacha/ui')
  console.log('   • Component-level imports')
  console.log('   • Tailwind integration')
  console.log('   • Theme system')
  process.exit(0)
} else {
  console.log('❌ Some tests failed. Please check the issues above.')
  process.exit(1)
}
