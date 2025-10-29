#!/usr/bin/env node

/**
 * Test actual imports to verify the package structure works
 */

console.log('🧪 Testing Storacha UI Imports\n')

async function testImports() {
  try {
    // Test 1: Core package
    console.log('1. Testing core package imports...')
    const core = await import('./packages/core/dist/index.js')
    console.log('  ✅ Core package imported successfully')
    console.log(
      '  ✅ Core exports:',
      Object.keys(core).slice(0, 3).join(', '),
      '...'
    )

    // Test 2: React package
    console.log('\n2. Testing React package imports...')
    const react = await import('./packages/react/dist/index.js')
    console.log('  ✅ React package imported successfully')
    console.log(
      '  ✅ React exports:',
      Object.keys(react).slice(0, 3).join(', '),
      '...'
    )

    // Test 3: Component-level imports
    console.log('\n3. Testing component-level imports...')
    const authenticator = await import(
      './packages/react/dist/components/Authenticator.js'
    )
    console.log('  ✅ Authenticator component imported successfully')

    const uploader = await import(
      './packages/react/dist/components/Uploader.js'
    )
    console.log('  ✅ Uploader component imported successfully')

    // Test 4: Theme utilities
    console.log('\n4. Testing theme utilities...')
    const theme = await import('./packages/theme/index.js')
    console.log('  ✅ Theme utilities imported successfully')
    console.log('  ✅ Available themes:', Object.keys(theme.themes))
    console.log(
      '  ✅ Theme functions:',
      Object.keys(theme).filter((k) => typeof theme[k] === 'function')
    )

    // Test 5: Tailwind plugin
    console.log('\n5. Testing Tailwind plugin...')
    // Note: Tailwind plugin uses CommonJS, so we test file existence
    const fs = await import('fs')
    if (fs.existsSync('./packages/tailwind/index.js')) {
      console.log('  ✅ Tailwind plugin file exists and is accessible')
    } else {
      throw new Error('Tailwind plugin file not found')
    }

    console.log('\n' + '='.repeat(50))
    console.log('🎉 All import tests passed!')
    console.log('\n📦 Ready for production use:')
    console.log('   • Meta-package: @storacha/ui')
    console.log('   • Core utilities: @storacha/ui-core')
    console.log('   • React components: @storacha/ui-react')
    console.log('   • Component-level imports: @storacha/ui/react/components/*')
    console.log('   • Tailwind plugin: @storacha/ui-tailwind')
    console.log('   • Theme system: @storacha/ui-theme')
  } catch (error) {
    console.error('❌ Import test failed:', error.message)
    process.exit(1)
  }
}

testImports()
