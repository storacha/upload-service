#!/usr/bin/env node
import fs from 'node:fs'
import { Readable } from 'node:stream'
import crypto from 'node:crypto'
import sade from 'sade'
import { CARReaderStream } from 'carstream'
import * as Digest from 'multiformats/hashes/digest'
import { sha256 } from 'multiformats/hashes/sha2'
import { base58btc } from 'multiformats/bases/base58'
import * as Link from 'multiformats/link'
import { DigestMap } from './digest-map.js'
import * as ShardedDAGIndex from './sharded-dag-index.js'

/** @import * as API from './api.js' */

const getVersion = () =>
  // @ts-expect-error JSON.parse works with Buffer in Node.js
  JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)))

const cli = sade('blob-index')

cli.version(getVersion()).example('build path/to/data.car')

cli
  .command('build [car]...')
  .example('build path/to/data.car')
  .describe(
    'Build a sharded DAG index for the passed CAR file(s). You can pass multiple files and you can also pipe a CAR file to the command.'
  )
  .option('-r, --root', 'Content root CID')
  .option('-o, --output', 'Output path')
  .action(async (path, options) => {
    const { _: rest } = options
    /** @type {API.UnknownLink|undefined} */
    let content = options.root && Link.parse(options.root)
    const srcs = /** @type {Array<() => ReadableStream>} */ (
      path
        ? [path, ...rest].map(
            (p) => () => Readable.toWeb(fs.createReadStream(p))
          )
        : [() => Readable.toWeb(process.stdin)]
    )

    /** @type {Map<API.ShardDigest, Map<API.SliceDigest, API.Position>>} */
    const shards = new DigestMap()
    for (const src of srcs) {
      const carReader = new CARReaderStream()
      /** @type {Map<API.SliceDigest, API.Position>} */
      const slices = new DigestMap()
      const hasher = crypto.createHash('sha256')

      const [s0, s1] = src().tee()
      await Promise.all([
        s0.pipeThrough(carReader).pipeTo(
          new WritableStream({
            write: ({ cid, offset, length }) => {
              slices.set(getDigest(cid.multihash), [offset, length])
            },
          })
        ),
        s1.pipeTo(
          new WritableStream({
            write: (chunk) => {
              hasher.update(chunk)
            },
          })
        ),
      ])

      if (!content) {
        const header = await carReader.getHeader()
        content = header.roots[0]
      }

      shards.set(Digest.create(sha256.code, hasher.digest()), slices)
    }

    if (!content) {
      throw new Error('content root not specified and not found in sources')
    }

    const result = await ShardedDAGIndex.archive({ content, shards })
    if (result.error) {
      throw new Error('archiving sharded DAG index', { cause: result.error })
    }

    if (options.output) {
      return await fs.promises.writeFile(options.output, result.ok)
    }

    process.stdout.write(result.ok)
  })

cli
  .command('inspect [index]')
  .example('inspect path/to/index.car.idx')
  .describe('Inspect a sharded DAG index.')
  .action(async (path) => {
    let bytes
    if (path) {
      bytes = await fs.promises.readFile(path)
    } else {
      const chunks = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      bytes = await new Blob(chunks).bytes()
    }
    const result = ShardedDAGIndex.extract(bytes)
    if (result.error) {
      throw new Error('extracting sharded DAG index', { cause: result.error })
    }

    console.log(`Content: ${result.ok.content}`)
    console.log('Shards:')
    let i = 0
    for (const [shard, slices] of result.ok.shards) {
      console.log(`  ${i}: ${base58btc.encode(shard.bytes)}`)
      console.log('    Slices:')
      let j = 0
      for (const [slice, position] of slices) {
        console.log(
          `      ${j}: ${base58btc.encode(slice.bytes)} @ ${position[0]}-${
            position[0] + position[1]
          }`
        )
        j++
      }
      i++
    }
  })

cli
  .command('help [cmd]', 'Show help text.', { default: true })
  .action((cmd) => {
    try {
      cli.help(cmd)
    } catch (err) {
      console.log(`
ERROR
  Invalid command: ${cmd}
  
Run \`$ blob-index --help\` for more info.
`)
      process.exit(1)
    }
  })

cli.parse(process.argv)

/** @param {API.MultihashDigest} digest */
const getDigest = (digest) => {
  const { buffer, byteOffset, byteLength } = digest.bytes
  const isSubArray = !(byteOffset === 0 && buffer.byteLength === byteLength)
  return isSubArray ? Digest.create(digest.code, digest.digest.slice()) : digest
}
