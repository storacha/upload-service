import { Plugin, RollupOptions } from 'rollup'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import size from 'rollup-plugin-size'
import visualizer from 'rollup-plugin-visualizer'
import replace from '@rollup/plugin-replace'
import nodeResolve from '@rollup/plugin-node-resolve'
import svelte from 'rollup-plugin-svelte'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import path from 'path'

interface Options {
  input: string
  packageDir: string
  external: RollupOptions['external']
  banner: string
  jsName: string
  outputFile: string
  globals: Record<string, string>
}

const umdDevPlugin = (type: 'development' | 'production'): Plugin =>
  replace({
    'process.env.NODE_ENV': `"${type}"`,
    delimiters: ['', ''],
    preventAssignment: true
  })

const babelPlugin = babel({
  babelHelpers: 'bundled',
  exclude: /node_modules/,
  extensions: ['.ts', '.tsx']
})

export default function rollup (options: RollupOptions): RollupOptions[] {
  return [
    ...buildConfigs({
      name: 'uploader-core',
      packageDir: 'packages/uploader-core',
      jsName: 'UploaderCore',
      outputFile: 'uploader-core',
      entryFile: 'src/index.ts',
      globals: {}
    }),
    ...buildConfigs({
      name: 'react-wallet',
      packageDir: 'packages/react-wallet',
      jsName: 'ReactWallet',
      outputFile: 'react-wallet',
      entryFile: 'src/index.ts',
      globals: {
        react: 'React'
      }
    }),
    ...buildConfigs({
      name: 'react-uploader',
      packageDir: 'packages/react-uploader',
      jsName: 'ReactUploader',
      outputFile: 'react-uploader',
      entryFile: 'src/index.ts',
      globals: {
        react: 'React'
      }
    })
  ]
}

function buildConfigs (opts: {
  packageDir: string
  name: string
  jsName: string
  outputFile: string
  entryFile: string
  globals: Record<string, string>
}): RollupOptions[] {
  const input = path.resolve(opts.packageDir, opts.entryFile)
  const externalDeps = Object.keys(opts.globals)

  const external = (moduleName): boolean => externalDeps.includes(moduleName)
  const banner = createBanner(opts.name)

  const options: Options = {
    input,
    jsName: opts.jsName,
    outputFile: opts.outputFile,
    packageDir: opts.packageDir,
    external,
    banner,
    globals: opts.globals
  }

  return [esm(options), cjs(options), umdDev(options), umdProd(options)]
}

function esm ({ input, packageDir, external, banner }: Options): RollupOptions {
  return {
    // ESM
    external,
    input,
    output: {
      format: 'esm',
      sourcemap: true,
      dir: `${packageDir}/build/esm`,
      banner
    },
    plugins: [
      svelte(),
      commonjs(),
      json(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'], browser: true })
    ]
  }
}

function cjs ({ input, external, packageDir, banner }: Options): RollupOptions {
  return {
    // CJS
    external,
    input,
    output: {
      format: 'cjs',
      sourcemap: true,
      dir: `${packageDir}/build/cjs`,
      // preserveModules: true,
      exports: 'named',
      banner
    },
    plugins: [
      svelte(),
      commonjs(),
      json(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'], browser: true })
    ]
  }
}

function umdDev ({
  input,
  external,
  packageDir,
  outputFile,
  globals,
  banner,
  jsName
}: Options): RollupOptions {
  return {
    // UMD (Dev)
    external,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `${packageDir}/build/umd/index.development.js`,
      name: jsName,
      globals,
      banner
    },
    plugins: [
      svelte(),
      commonjs(),
      json(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'], browser: true }),
      umdDevPlugin('development')
    ]
  }
}

function umdProd ({
  input,
  external,
  packageDir,
  outputFile,
  globals,
  banner,
  jsName
}: Options): RollupOptions {
  return {
    // UMD (Prod)
    external,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `${packageDir}/build/umd/index.production.js`,
      name: jsName,
      globals,
      banner
    },
    plugins: [
      svelte(),
      commonjs(),
      json(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'], browser: true }),
      umdDevPlugin('production'),
      terser({
        mangle: true,
        compress: true
      }),
      size({}),
      visualizer({
        filename: `${packageDir}/build/stats-html.html`,
        gzipSize: true
      }),
      visualizer({
        filename: `${packageDir}/build/stats.json`,
        json: true,
        gzipSize: true
      })
    ]
  }
}

function createBanner (libraryName: string): string {
  return `/**
 * ${libraryName}
 *
 * Copyright (c) Web3.Storage
 *
 * This source code is licensed under Apache-2.0 OR MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license Apache-2.0 OR MIT
 */`
}
