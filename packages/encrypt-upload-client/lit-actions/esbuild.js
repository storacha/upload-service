import { build } from 'esbuild'

build({
  entryPoints: ['./lit-actions/validate-decrypt-invocation.js'],
  bundle: true,
  minify: false,
  sourcemap: false,
  outfile: './lit-actions/dist/validate-decrypt-invocation.js',
  sourceRoot: './',
  platform: 'browser',
  format: 'esm', // Use ES modules format
  metafile: true,
}).catch((err) => {
  console.error(err)
  return process.exit(1)
})
