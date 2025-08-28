import { defineConfig } from 'tsup'
import path from 'path'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
  // here lies the main trick. esbuild should bundle the core lib
  // instead of us having to require it in prod when people try use it in
  // an external project
  noExternal: ['@storacha/ui-core'],
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      '@storacha/ui-core': path.resolve(__dirname, '../core/src/index.ts'),
    }
  },
  minify: true,
  // we don't need fs in the browser. it wouldn't even work.
  // but @ipld/car needs/uses it, perhaps for the indexing service
  platform: 'browser',
})
