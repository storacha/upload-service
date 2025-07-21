import * as PieceHasher from '@web3-storage/data-segment/multihash'
import { Storefront } from '@storacha/filecoin-client'
import * as Link from 'multiformats/link'
import * as raw from 'multiformats/codecs/raw'
import * as Digest from 'multiformats/hashes/digest'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Blob from './blob/index.js'
import * as BlobAdd from './blob/add.js'
import * as Index from './index/index.js'
import * as IndexAdd from './index/add.js'
import * as Upload from './upload/index.js'
import * as UploadAdd from './upload/add.js'
import * as UnixFS from './unixfs.js'
import * as CAR from './car.js'
import {
  ShardingStream,
  defaultFileComparator,
  SHARD_SIZE,
} from './sharding.js'
import { ShardedDAGIndex, indexShardedDAG } from '@storacha/blob-index'

export { Blob, Index, Upload, UnixFS, CAR }
export * from './sharding.js'
export { receiptsEndpoint } from './service.js'
export * as Receipt from './receipts.js'

/** @param {Uint8Array} bytes */
const isSubArray = (bytes) =>
  bytes.byteOffset !== 0 || bytes.buffer.byteLength !== bytes.byteLength

/**
 * Uploads a file to the service and returns the root data CID for the
 * generated DAG.
 *
 * Required delegated capability proofs: `blob/add`, `index/add`,
 * `filecoin/offer`, `upload/add`
 *
 * @param {import('./types.js').InvocationConfig|import('./types.js').InvocationConfigurator} conf Configuration
 * for the UCAN invocation. An object with `issuer`, `with` and `proofs`, or a
 * function that generates this object.
 *
 * The `issuer` is the signing authority that is issuing the UCAN
 * invocation(s). It is typically the user _agent_.
 *
 * The `with` is the resource the invocation applies to. It is typically the
 * DID of a space.
 *
 * The `proofs` are a set of capability delegations that prove the issuer
 * has the capability to perform the action.
 *
 * The issuer needs the `blob/add`, `index/add`, `filecoin/offer` and
 * `upload/add` delegated capability.
 * @param {import('./types.js').BlobLike} file File data.
 * @param {import('./types.js').UploadFileOptions} [options]
 */
export async function uploadFile(conf, file, options = {}) {
  const shardSize = options.shardSize ?? SHARD_SIZE
  if (file.size != null && file.size < shardSize) {
    const { blocks, cid } = await UnixFS.encodeFile(file, options)
    return await uploadBlocks(conf, blocks, { rootCID: cid, ...options })
  }
  return await uploadBlockStream(
    conf,
    UnixFS.createFileEncoderStream(file, options),
    options
  )
}

/**
 * Uploads a directory of files to the service and returns the root data CID
 * for the generated DAG. All files are added to a container directory, with
 * paths in file names preserved.
 *
 * Required delegated capability proofs: `blob/add`, `index/add`,
 * `filecoin/offer`, `upload/add`
 *
 * @param {import('./types.js').InvocationConfig|import('./types.js').InvocationConfigurator} conf Configuration
 * for the UCAN invocation. An object with `issuer`, `with` and `proofs`, or a
 * function that generates this object
 *
 * The `issuer` is the signing authority that is issuing the UCAN
 * invocation(s). It is typically the user _agent_.
 *
 * The `with` is the resource the invocation applies to. It is typically the
 * DID of a space.
 *
 * The `proofs` are a set of capability delegations that prove the issuer
 * has the capability to perform the action.
 *
 * The issuer needs the `blob/add`, `index/add`, `filecoin/offer` and
 * `upload/add` delegated capability.
 * @param {import('./types.js').FileLike[]} files  Files that should be in the directory.
 * To ensure determinism in the IPLD encoding, files are automatically sorted by `file.name`.
 * To retain the order of the files as passed in the array, set `customOrder` option to `true`.
 * @param {import('./types.js').UploadDirectoryOptions} [options]
 */
export async function uploadDirectory(conf, files, options = {}) {
  const { customOrder = false } = options
  const entries = customOrder ? files : [...files].sort(defaultFileComparator)

  let size = 0
  let isKnownSize = true
  for (const entry of entries) {
    if (entry.size == null) {
      isKnownSize = false
      break
    }
    size += entry.size
  }

  const shardSize = options.shardSize ?? SHARD_SIZE
  if (isKnownSize && size < shardSize) {
    const { blocks, cid } = await UnixFS.encodeDirectory(entries, options)
    return await uploadBlocks(conf, blocks, { rootCID: cid, ...options })
  }

  return await uploadBlockStream(
    conf,
    UnixFS.createDirectoryEncoderStream(entries, options),
    options
  )
}

/**
 * Uploads a CAR file to the service.
 *
 * The difference between this function and `Store.add` is that the CAR file is
 * automatically sharded and an "upload" is registered, linking the individual
 * shards (see `Upload.add`).
 *
 * Use the `onShardStored` callback to obtain the CIDs of the CAR file shards.
 *
 * Required delegated capability proofs: `blob/add`, `index/add`,
 * `filecoin/offer`, `upload/add`
 *
 * @param {import('./types.js').InvocationConfig|import('./types.js').InvocationConfigurator} conf Configuration
 * for the UCAN invocation. An object with `issuer`, `with` and `proofs`, or a
 * function that generates this object
 *
 * The `issuer` is the signing authority that is issuing the UCAN
 * invocation(s). It is typically the user _agent_.
 *
 * The `with` is the resource the invocation applies to. It is typically the
 * DID of a space.
 *
 * The `proofs` are a set of capability delegations that prove the issuer
 * has the capability to perform the action.
 *
 * The issuer needs the `blob/add`, `index/add`, `filecoin/offer` and `upload/add` delegated capability.
 * @param {import('./types.js').BlobLike} car CAR file.
 * @param {import('./types.js').UploadOptions} [options]
 */
export async function uploadCAR(conf, car, options = {}) {
  const shardSize = options.shardSize ?? SHARD_SIZE
  if (car.size != null && car.size < shardSize) {
    const { blocks, roots } = await CAR.decode(car)
    return await uploadBlocks(conf, blocks, { rootCID: roots[0], ...options })
  }
  const blocks = new CAR.BlockStream(car)
  options.rootCID = options.rootCID ?? (await blocks.getRoots())[0]
  return await uploadBlockStream(conf, blocks, options)
}

/**
 * @param {import('./types.js').InvocationConfig|import('./types.js').InvocationConfigurator} conf
 * @param {ReadableStream<import('@ipld/unixfs').Block>} blocks
 * @param {import('./types.js').UploadOptions} [options]
 * @returns {Promise<import('./types.js').AnyLink>}
 */
export async function uploadBlockStream(
  conf,
  blocks,
  { pieceHasher = PieceHasher, ...options } = {}
) {
  /** @type {import('./types.js').InvocationConfigurator} */
  const configure = typeof conf === 'function' ? conf : () => conf
  /** @type {Array<Map<import('./types.js').SliceDigest, import('./types.js').Position>>} */
  const shardIndexes = []
  /** @type {import('./types.js').CARLink[]} */
  const shards = []
  /** @type {import('./types.js').AnyLink?} */
  let root = null
  await blocks
    .pipeThrough(new ShardingStream(options))
    .pipeThrough(
      /** @type {TransformStream<import('./types.js').IndexedCARFile, import('./types.js').CARMetadata>} */
      (
        new TransformStream({
          async transform(car, controller) {
            const bytes = new Uint8Array(await car.arrayBuffer())
            const digest = await sha256.digest(bytes)
            const conf = await configure([
              {
                can: BlobAdd.ability,
                nb: BlobAdd.input(digest, bytes.length),
              },
            ])
            // Invoke blob/add and write bytes to write target
            await Blob.add(conf, digest, bytes, options)
            const cid = Link.create(CAR.code, digest)

            let piece
            if (pieceHasher) {
              const multihashDigest = await pieceHasher.digest(bytes)
              /** @type {import('@storacha/capabilities/types').PieceLink} */
              piece = Link.create(raw.code, multihashDigest)
              const content = Link.create(raw.code, digest)

              // Invoke filecoin/offer for data
              const result = await Storefront.filecoinOffer(
                {
                  issuer: conf.issuer,
                  audience: conf.audience,
                  // Resource of invocation is the issuer did for being self issued
                  with: conf.issuer.did(),
                  proofs: conf.proofs,
                },
                content,
                piece,
                options
              )

              if (result.out.error) {
                throw new Error(
                  'failed to offer piece for aggregation into filecoin deal',
                  { cause: result.out.error }
                )
              }
            }
            const { version, roots, size, slices } = car
            controller.enqueue({ version, roots, size, cid, piece, slices })
          },
        })
      )
    )
    .pipeTo(
      new WritableStream({
        write(meta) {
          root = root || meta.roots[0]
          shards.push(meta.cid)

          // Make copies of digests that are views on bigger byte arrays. This
          // prevents memory leak where the bytes for the rest of the CAR cannot
          // be released because the digest is a view over just a small portion
          // of the chunk.
          for (const [s, p] of meta.slices) {
            if (isSubArray(s.bytes)) {
              meta.slices.set(Digest.decode(s.bytes.slice()), p)
            }
          }

          // add the CAR shard itself to the slices
          meta.slices.set(meta.cid.multihash, [0, meta.size])
          shardIndexes.push(meta.slices)

          if (options.onShardStored) options.onShardStored(meta)
        },
      })
    )

  /* c8 ignore next */
  if (!root) throw new Error('missing root CID')

  const indexBytes = await indexShardedDAG(root, shards, shardIndexes)
  /* c8 ignore next 3 */
  if (!indexBytes.ok) {
    throw new Error('failed to archive DAG index', { cause: indexBytes.error })
  }

  const indexDigest = await sha256.digest(indexBytes.ok)
  const indexLink = Link.create(CAR.code, indexDigest)

  const [blobAddConf, indexAddConf, uploadAddConf] = await Promise.all([
    configure([
      {
        can: BlobAdd.ability,
        nb: BlobAdd.input(indexDigest, indexBytes.ok.length),
      },
    ]),
    configure([
      {
        can: IndexAdd.ability,
        nb: IndexAdd.input(indexLink),
      },
    ]),
    configure([
      {
        can: UploadAdd.ability,
        nb: UploadAdd.input(root, shards),
      },
    ]),
  ])

  // Store the index in the space
  await Blob.add(blobAddConf, indexDigest, indexBytes.ok, options)
  // Register the index with the service
  await Index.add(indexAddConf, indexLink, options)
  // Register an upload with the service
  await Upload.add(uploadAddConf, root, shards, options)

  return root
}

/**
 * @param {import('./types.js').InvocationConfig|import('./types.js').InvocationConfigurator} conf
 * @param {import('@ipld/unixfs').Block[]} blocks
 * @param {import('./types.js').UploadOptions} [options]
 * @returns {Promise<import('./types.js').AnyLink>}
 */
export async function uploadBlocks(
  conf,
  blocks,
  { pieceHasher = PieceHasher, ...options } = {}
) {
  /** @type {import('./types.js').InvocationConfigurator} */
  const configure = typeof conf === 'function' ? conf : () => conf

  /** @type {import('./types.js').IndexedCARFile} */
  let car
  const blockStream = new ReadableStream({
    pull(controller) {
      for (const b of blocks) {
        controller.enqueue(b)
      }
      controller.close()
    },
  })

  // encode indexed CAR
  await blockStream
    .pipeThrough(new ShardingStream({ ...options, shardSize: Infinity }))
    .pipeTo(
      new WritableStream({
        write: (c) => {
          car = c
        },
      })
    )

  /* c8 ignore next 2 */
  // @ts-expect-error no used before defined
  if (!car) throw new Error('missing CAR output')

  const root = car.roots[0]
  const bytes = new Uint8Array(await car.arrayBuffer())
  const digest = await sha256.digest(bytes)

  const [shardLink, indexLink] = await Promise.all([
    (async () => {
      const conf = await configure([
        {
          can: BlobAdd.ability,
          nb: BlobAdd.input(digest, bytes.length),
        },
      ])

      // Invoke blob/add and write bytes to write target
      await Blob.add(conf, digest, bytes, options)
      const cid = Link.create(CAR.code, digest)

      let piece
      if (pieceHasher) {
        const multihashDigest = await pieceHasher.digest(bytes)
        /** @type {import('@storacha/capabilities/types').PieceLink} */
        piece = Link.create(raw.code, multihashDigest)

        // Invoke filecoin/offer for data
        const result = await Storefront.filecoinOffer(
          {
            issuer: conf.issuer,
            audience: conf.audience,
            // Resource of invocation is the issuer did for being self issued
            with: conf.issuer.did(),
            proofs: conf.proofs,
          },
          Link.create(raw.code, digest),
          piece,
          options
        )

        if (result.out.error) {
          throw new Error(
            'failed to offer piece for aggregation into filecoin deal',
            { cause: result.out.error }
          )
        }
      }
      const { version, roots, size, slices } = car
      options.onShardStored?.({ version, roots, size, piece, cid, slices })
      return cid
    })(),
    (async () => {
      const index = ShardedDAGIndex.create(root)
      for (const [slice, pos] of car.slices) {
        index.setSlice(digest, slice, pos)
      }
      // add the CAR shard itself to the slices
      index.setSlice(digest, digest, [0, car.size])

      const indexBytes = await index.archive()
      /* c8 ignore next 5 */
      if (!indexBytes.ok) {
        throw new Error('failed to archive DAG index', {
          cause: indexBytes.error,
        })
      }

      const indexDigest = await sha256.digest(indexBytes.ok)
      const indexLink = Link.create(CAR.code, indexDigest)

      const conf = await configure([
        {
          can: BlobAdd.ability,
          nb: BlobAdd.input(indexDigest, indexBytes.ok.length),
        },
      ])

      // Store the index in the space
      await Blob.add(conf, indexDigest, indexBytes.ok, options)
      return indexLink
    })(),
  ])

  await Promise.all([
    (async () => {
      const conf = await configure([
        {
          can: IndexAdd.ability,
          nb: IndexAdd.input(indexLink),
        },
      ])
      // Register the index with the service
      await Index.add(conf, indexLink, options)
    })(),
    (async () => {
      const conf = await configure([
        {
          can: UploadAdd.ability,
          nb: UploadAdd.input(root, [shardLink]),
        },
      ])
      // Register an upload with the service
      await Upload.add(conf, root, [shardLink], options)
    })(),
  ])

  return root
}
