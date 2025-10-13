#!/usr/bin/env node

/**
 * Build validation script for Storacha UI packages
 * Ensures all exports are properly built and accessible
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packagesDir = join(__dirname, '..')

const packages = [
  'packages/core',
  'packages/react',
  'packages/tailwind',
  'packages/theme',
]

function validatePackage(packagePath) {
  const fullPath = join(packagesDir, packagePath)
  const packageJsonPath = join(fullPath, 'package.json')

  if (!existsSync(packageJsonPath)) {
    throw new Error(`Package.json not found: ${packageJsonPath}`)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const { name, exports } = packageJson

  console.log(`✓ Validating ${name}`)

  // Check if exports exist
  if (exports) {
    for (const [exportPath, config] of Object.entries(exports)) {
      if (typeof config === 'object' && config.import) {
        // Skip wildcard exports for now - they're handled by the build system
        if (config.import.includes('*')) {
          console.log(`  ✓ Wildcard export: ${exportPath}`)
          continue
        }

        const importPath = join(fullPath, config.import)
        if (!existsSync(importPath)) {
          throw new Error(
            `Export file missing: ${importPath} for ${exportPath}`
          )
        }
      }
    }
  }

  // Check main/types fields
  if (packageJson.main) {
    const mainPath = join(fullPath, packageJson.main)
    if (!existsSync(mainPath)) {
      throw new Error(`Main file missing: ${mainPath}`)
    }
  }

  if (packageJson.types) {
    const typesPath = join(fullPath, packageJson.types)
    if (!existsSync(typesPath)) {
      throw new Error(`Types file missing: ${typesPath}`)
    }
  }

  console.log(`  ✓ All exports validated for ${name}`)
}

function validateMetaPackage() {
  const metaPackageJson = join(packagesDir, 'package.json')

  if (!existsSync(metaPackageJson)) {
    throw new Error('Meta package.json not found')
  }

  const packageJson = JSON.parse(readFileSync(metaPackageJson, 'utf8'))
  console.log(`✓ Validating meta-package ${packageJson.name}`)

  // Validate subpath exports
  const { exports } = packageJson
  if (!exports) {
    throw new Error('Meta-package missing exports field')
  }

  const requiredExports = ['.', './core', './react', './tailwind', './theme']

  for (const exportPath of requiredExports) {
    if (!exports[exportPath]) {
      throw new Error(`Missing export: ${exportPath}`)
    }
  }

  console.log('  ✓ All meta-package exports validated')
}

async function main() {
  try {
    console.log('🔍 Validating Storacha UI package structure...\n')

    // Validate individual packages
    for (const pkg of packages) {
      validatePackage(pkg)
    }

    // Validate meta-package
    validateMetaPackage()

    console.log('\n✅ All packages validated successfully!')
    console.log('\n📦 Package structure:')
    console.log('├── @storacha/ui (meta-package)')
    console.log('├── @storacha/ui-core')
    console.log('├── @storacha/ui-react')
    console.log('├── @storacha/ui-tailwind')
    console.log('└── @storacha/ui-theme')
  } catch (error) {
    console.error('❌ Validation failed:', error.message)
    process.exit(1)
  }
}

main()
