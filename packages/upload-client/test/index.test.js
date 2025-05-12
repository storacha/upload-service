import assert from 'assert'
import * as Client from '@ucanto/client'
import * as Server from '@ucanto/server'
import { provide } from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import * as Signer from '@ucanto/principal/ed25519'
import * as UCAN from '@storacha/capabilities/ucan'
import * as BlobCapabilities from '@storacha/capabilities/space/blob'
import * as IndexCapabilities from '@storacha/capabilities/space/index'
import * as UploadCapabilities from '@storacha/capabilities/upload'
import * as StorefrontCapabilities from '@storacha/capabilities/filecoin/storefront'
import { Piece } from '@web3-storage/data-segment'
import { uploadFile, uploadDirectory, uploadCAR } from '../src/index.js'
import { serviceSigner } from './fixtures.js'
import { randomBlock, randomBytes } from './helpers/random.js'
import { toCAR } from './helpers/car.js'
import { File } from './helpers/shims.js'
import { mockService } from './helpers/mocks.js'
import {
  validateAuthorization,
  setupBlobAddSuccessResponse,
  receiptsEndpoint,
} from './helpers/utils.js'
import {
  blockEncodingLength,
  encode,
  headerEncodingLength,
} from '../src/car.js'
import { toBlock } from './helpers/block.js'
import { getFilecoinOfferResponse } from './helpers/filecoin.js'
import { defaultFileComparator } from '../src/sharding.js'

/**
 * @param {Uint8Array} bytes
 * @param {'known'|'unknown'} sizeVariant
 */
const toBlob = (bytes, sizeVariant) => {
  const blob = new Blob([bytes])
  return sizeVariant === 'known' ? blob : { stream: () => blob.stream() }
}

/**
 * @param {string} name
 * @param {Uint8Array} bytes
 * @param {'known'|'unknown'} sizeVariant
 */
const toFile = (name, bytes, sizeVariant) => {
  const file = new File([bytes], name)
  return sizeVariant === 'known' ? file : { name, stream: () => file.stream() }
}

for (const sizeVariant of /** @type {const} */ (['known', 'unknown'])) {
  describe(`uploadFile (${sizeVariant} size)`, () => {
    it('uploads a file to the service', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate() // The "user" that will ask the service to accept the upload
      const bytes = await randomBytes(128)
      const file = toBlob(bytes, sizeVariant)
      const expectedCar = await toCAR(bytes)
      const piece = Piece.fromPayload(bytes).link

      /** @type {import('../src/types.js').CARLink|undefined} */
      let carCID

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            add: provide(
              BlobCapabilities.add,
              // @ts-ignore Argument of type
              async function ({ invocation, capability }) {
                assert.equal(invocation.issuer.did(), agent.did())
                assert.equal(invocation.capabilities.length, 1)
                assert.equal(capability.can, BlobCapabilities.add.can)
                assert.equal(capability.with, space.did())
                return setupBlobAddSuccessResponse(
                  { issuer: space, audience: agent, with: space, proofs },
                  invocation
                )
              }
            ),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, piece, invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadCapabilities.add.can)
            assert.equal(invCap.with, space.did())
            assert.equal(invCap.nb?.shards?.length, 1)
            assert.equal(String(invCap.nb?.shards?.[0]), carCID?.toString())
            return {
              ok: {
                root: expectedCar.roots[0],
                shards: [expectedCar.cid],
              },
            }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })
      const dataCID = await uploadFile(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        file,
        {
          connection,
          onShardStored: (meta) => {
            carCID = meta.cid
          },
          receiptsEndpoint,
        }
      )

      assert(service.space.blob.add.called)
      assert.equal(service.space.blob.add.callCount, 2)
      assert(service.filecoin.offer.called)
      assert.equal(service.filecoin.offer.callCount, 1)
      assert(service.space.index.add.called)
      assert.equal(service.space.index.add.callCount, 1)
      assert(service.upload.add.called)
      assert.equal(service.upload.add.callCount, 1)

      assert.equal(carCID?.toString(), expectedCar.cid.toString())
      assert.equal(dataCID.toString(), expectedCar.roots[0].toString())
    })

    it('allows custom shard size to be set', async function () {
      this.timeout(10_000)
      const space = await Signer.generate()
      const agent = await Signer.generate() // The "user" that will ask the service to accept the upload
      const bytes = await randomBytes(1024 * 1024 * 5)
      const file = toBlob(bytes, sizeVariant)
      const piece = Piece.fromPayload(bytes).link
      /** @type {import('../src/types.js').CARLink[]} */
      const carCIDs = []

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            // @ts-ignore Argument of type
            add: provide(BlobCapabilities.add, ({ invocation }) => {
              return setupBlobAddSuccessResponse(
                { issuer: space, audience: agent, with: space, proofs },
                invocation
              )
            }),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, piece, invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ capability }) => {
            if (!capability.nb) throw new Error('nb must be present')
            return { ok: capability.nb }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })
      await uploadFile(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        file,
        {
          connection,
          // chunk size = 1_048_576
          // encoded block size = 1_048_615
          // shard size = 2_097_153 (as configured below)
          // total file size = 5_242_880 (as above)
          // so, at least 2 shards, but 2 encoded blocks (_without_ CAR header) = 2_097_230
          // ...which is > shard size of 2_097_153
          // so we actually end up with a shard for each block - 5 CARs!
          shardSize: 1024 * 1024 * 2 + 1,
          onShardStored: (meta) => carCIDs.push(meta.cid),
          receiptsEndpoint,
        }
      )

      assert.equal(carCIDs.length, 5)
    })

    it('fails to upload a file to the service if `filecoin/piece` invocation fails', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate() // The "user" that will ask the service to accept the upload
      const bytes = await randomBytes(1024 * 1024 * 5)
      const file = toBlob(bytes, sizeVariant)

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            // @ts-ignore Argument of type
            add: provide(BlobCapabilities.add, ({ invocation, capability }) => {
              assert.equal(invocation.issuer.did(), agent.did())
              assert.equal(invocation.capabilities.length, 1)
              assert.equal(capability.can, BlobCapabilities.add.can)
              assert.equal(capability.with, space.did())
              return setupBlobAddSuccessResponse(
                { issuer: space, audience: agent, with: space, proofs },
                invocation
              )
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async function () {
              return {
                error: new Server.Failure('did not find piece'),
              }
            },
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })
      await assert.rejects(async () =>
        uploadFile(
          { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
          file,
          {
            connection,
            receiptsEndpoint,
          }
        )
      )

      assert(service.space.blob.add.called)
      // when size is known, we are below shard threshold and will make 2 blob
      // add invocations regardless because we parallelize blob add for the
      // data and blob add for the index.
      assert.equal(
        service.space.blob.add.callCount,
        sizeVariant === 'known' ? 2 : 1
      )
      assert(service.filecoin.offer.called)
      assert.equal(service.filecoin.offer.callCount, 1)
    })
  })

  describe(`uploadDirectory (${sizeVariant} size)`, () => {
    it('uploads a directory to the service', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate()
      const bytesList = [await randomBytes(128), await randomBytes(32)]
      const files = bytesList.map((bytes, index) =>
        toFile(`${index}.txt`, bytes, sizeVariant)
      )
      const pieces = bytesList.map((bytes) => Piece.fromPayload(bytes).link)

      /** @type {import('../src/types.js').CARLink?} */
      let carCID = null

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            // @ts-ignore Argument of type
            add: provide(BlobCapabilities.add, ({ invocation }) => {
              assert.equal(invocation.issuer.did(), agent.did())
              assert.equal(invocation.capabilities.length, 1)
              const invCap = invocation.capabilities[0]
              assert.equal(invCap.can, BlobCapabilities.add.can)
              assert.equal(invCap.with, space.did())
              return setupBlobAddSuccessResponse(
                { issuer: space, audience: agent, with: space, proofs },
                invocation
              )
            }),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, pieces[0], invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadCapabilities.add.can)
            assert.equal(invCap.with, space.did())
            assert.equal(invCap.nb?.shards?.length, 1)
            assert.equal(String(invCap.nb?.shards?.[0]), carCID?.toString())
            if (!invCap.nb) throw new Error('nb must be present')
            return { ok: invCap.nb }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })
      const dataCID = await uploadDirectory(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        files,
        {
          connection,
          onShardStored: (meta) => {
            carCID = meta.cid
          },
          receiptsEndpoint,
        }
      )

      assert(service.space.blob.add.called)
      assert.equal(service.space.blob.add.callCount, 2)
      assert(service.space.index.add.called)
      assert.equal(service.space.index.add.callCount, 1)
      assert(service.filecoin.offer.called)
      assert.equal(service.filecoin.offer.callCount, 1)
      assert(service.upload.add.called)
      assert.equal(service.upload.add.callCount, 1)

      assert(carCID)
      assert(dataCID)
    })

    it('allows custom shard size to be set', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate() // The "user" that will ask the service to accept the upload
      const bytesList = [await randomBytes(500_000)]
      const files = bytesList.map((bytes, index) =>
        toFile(`${index}.txt`, bytes, sizeVariant)
      )
      const pieces = bytesList.map((bytes) => Piece.fromPayload(bytes).link)
      /** @type {import('../src/types.js').CARLink[]} */
      const carCIDs = []

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            // @ts-ignore Argument of type
            add: provide(BlobCapabilities.add, ({ invocation }) => {
              return setupBlobAddSuccessResponse(
                { issuer: space, audience: agent, with: space, proofs },
                invocation
              )
            }),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, pieces[0], invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ capability }) => {
            if (!capability.nb) throw new Error('nb must be present')
            return { ok: capability.nb }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })
      await uploadDirectory(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        files,
        {
          connection,
          shardSize: 500_057, // should end up with 2 CAR files
          onShardStored: (meta) => carCIDs.push(meta.cid),
          receiptsEndpoint,
        }
      )

      // when size is known, we are below the shard size and so never create
      // more than 1 shard. However when size is unknown the CAR header and
      // encoding bytes will result in 2 shards.
      assert.equal(carCIDs.length, sizeVariant === 'known' ? 1 : 2)
    })

    it('sorts files unless options.customOrder', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate() // The "user" that will ask the service to accept the upload
      const someBytes = await randomBytes(32)
      const piece = Piece.fromPayload(someBytes).link

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])
      function createSimpleMockUploadServer() {
        /**
         * @type {Array<Server.ProviderInput<import('@ucanto/interface').InferInvokedCapability<import('@storacha/capabilities').SpaceBlob['add']|import('@storacha/capabilities').Upload['add']>>>}
         */
        const invocations = []
        const service = mockService({
          ucan: {
            conclude: provide(UCAN.conclude, () => {
              return { ok: { time: Date.now() } }
            }),
          },
          space: {
            blob: {
              // @ts-ignore Argument of type
              add: provide(BlobCapabilities.add, ({ invocation }) => {
                // @ts-ignore Argument of type
                invocations.push(invocation)
                return setupBlobAddSuccessResponse(
                  { issuer: space, audience: agent, with: space, proofs },
                  invocation
                )
              }),
            },
            index: {
              add: Server.provideAdvanced({
                capability: IndexCapabilities.add,
                handler: async ({ capability }) => {
                  assert(capability.nb.index)
                  return Server.ok({})
                },
              }),
            },
          },
          filecoin: {
            offer: Server.provideAdvanced({
              capability: StorefrontCapabilities.filecoinOffer,
              handler: async ({ invocation, context }) => {
                const invCap = invocation.capabilities[0]
                if (!invCap.nb) {
                  throw new Error('no params received')
                }
                return getFilecoinOfferResponse(context.id, piece, invCap.nb)
              },
            }),
          },
          upload: {
            add: provide(UploadCapabilities.add, ({ invocation }) => {
              // @ts-ignore Argument of type
              invocations.push(invocation)
              const { capabilities } = invocation
              if (!capabilities[0].nb) throw new Error('nb must be present')
              return { ok: capabilities[0].nb }
            }),
          },
        })
        const server = Server.create({
          id: serviceSigner,
          service,
          codec: CAR.inbound,
          validateAuthorization,
        })
        const connection = Client.connect({
          id: serviceSigner,
          codec: CAR.outbound,
          channel: server,
        })
        return { invocations, service, server, connection }
      }

      const unsortedFiles = [
        toFile('/b.txt', await randomBytes(32), sizeVariant),
        toFile('/b.txt', await randomBytes(32), sizeVariant),
        toFile('c.txt', await randomBytes(32), sizeVariant),
        toFile('a.txt', await randomBytes(32), sizeVariant),
      ]

      const uploadServiceForUnordered = createSimpleMockUploadServer()
      // uploading unsorted files should work because they should be sorted by `uploadDirectory`
      const uploadedDirUnsorted = await uploadDirectory(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        unsortedFiles,
        {
          connection: uploadServiceForUnordered.connection,
          receiptsEndpoint,
        }
      )

      const uploadServiceForOrdered = createSimpleMockUploadServer()
      // uploading sorted files should also work
      const uploadedDirSorted = await uploadDirectory(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        [...unsortedFiles].sort(defaultFileComparator),
        {
          connection: uploadServiceForOrdered.connection,
          receiptsEndpoint,
        }
      )

      // upload/add roots should be the same.
      assert.equal(
        uploadedDirUnsorted.toString(),
        uploadedDirSorted.toString(),
        'CID of upload/add root is same regardless of whether files param is sorted or unsorted'
      )

      // We also need to make sure the underlying shards are the same.
      const shardsForUnordered = uploadServiceForUnordered.invocations
        .flatMap((i) =>
          // @ts-ignore Property
          i.capabilities[0].can === 'upload/add'
            ? // @ts-ignore Property
              i.capabilities[0].nb.shards ?? []
            : []
        )
        .map((cid) => cid.toString())
      const shardsForOrdered = uploadServiceForOrdered.invocations
        .flatMap((i) =>
          // @ts-ignore Property
          i.capabilities[0].can === 'upload/add'
            ? // @ts-ignore Property
              i.capabilities[0].nb.shards ?? []
            : []
        )
        .map((cid) => cid.toString())
      assert.deepEqual(
        shardsForUnordered,
        shardsForOrdered,
        'upload/add .nb.shards is identical regardless of ordering of files passed to uploadDirectory'
      )

      // but if options.customOrder is truthy, the caller is indicating
      // they have customized the order of files, so `uploadDirectory` will not sort them
      const uploadServiceForCustomOrder = createSimpleMockUploadServer()
      const uploadedDirCustomOrder = await uploadDirectory(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        [...unsortedFiles],
        {
          connection: uploadServiceForCustomOrder.connection,
          customOrder: true,
          receiptsEndpoint,
        }
      )
      const shardsForCustomOrder = uploadServiceForCustomOrder.invocations
        .flatMap((i) =>
          // @ts-ignore Property
          i.capabilities[0].can === 'upload/add'
            ? // @ts-ignore Property
              i.capabilities[0].nb.shards ?? []
            : []
        )
        .map((cid) => cid.toString())
      assert.notDeepEqual(
        shardsForCustomOrder,
        shardsForOrdered,
        'should not produce sorted shards for customOrder files'
      )
      // upload/add roots will also be different
      assert.notEqual(
        uploadedDirCustomOrder.toString(),
        shardsForOrdered.toString()
      )
    })
  })

  describe(`uploadCAR (${sizeVariant} size)`, () => {
    it('uploads a CAR file to the service', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate()
      const blocks = [
        await randomBlock(128),
        await randomBlock(128),
        await randomBlock(128),
      ]
      const _car = await encode(blocks, blocks.at(-1)?.cid)
      const car =
        sizeVariant === 'known'
          ? _car
          : {
              version: _car.version,
              roots: _car.roots,
              stream: () => _car.stream(),
            }
      const someBytes = new Uint8Array(await _car.arrayBuffer())
      const piece = Piece.fromPayload(someBytes).link
      // Wanted: 2 shards
      // 2 * CAR header (34) + 2 * blocks (256), 2 * block encoding prefix (78)
      const shardSize =
        headerEncodingLength() * 2 +
        blocks
          .slice(0, -1)
          .reduce((size, block) => size + blockEncodingLength(block), 0)

      /** @type {import('../src/types.js').CARLink[]} */
      const carCIDs = []

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            // @ts-ignore Argument of type
            add: provide(BlobCapabilities.add, ({ invocation }) => {
              assert.equal(invocation.issuer.did(), agent.did())
              assert.equal(invocation.capabilities.length, 1)
              const invCap = invocation.capabilities[0]
              assert.equal(invCap.can, BlobCapabilities.add.can)
              assert.equal(invCap.with, space.did())
              return setupBlobAddSuccessResponse(
                { issuer: space, audience: agent, with: space, proofs },
                invocation
              )
            }),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, piece, invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadCapabilities.add.can)
            assert.equal(invCap.with, space.did())
            if (!invCap.nb) throw new Error('nb must be present')
            assert.equal(invCap.nb.shards?.length, 2)
            invCap.nb.shards?.forEach((s, i) => {
              assert(s.toString(), carCIDs[i].toString())
            })
            return {
              ok: invCap.nb,
            }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })

      await uploadCAR(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        car,
        {
          connection,
          onShardStored: (meta) => carCIDs.push(meta.cid),
          shardSize,
          receiptsEndpoint,
        }
      )

      assert(service.space.blob.add.called)
      assert.equal(service.space.blob.add.callCount, 3)
      assert(service.space.index.add.called)
      assert.equal(service.space.index.add.callCount, 1)
      assert(service.filecoin.offer.called)
      assert.equal(service.filecoin.offer.callCount, 2)
      assert(service.upload.add.called)
      assert.equal(service.upload.add.callCount, 1)
      assert.equal(carCIDs.length, 2)
    })

    it('computes piece CID', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate()
      const blocks = [
        await toBlock(new Uint8Array([1, 3, 8])),
        await toBlock(new Uint8Array([1, 1, 3, 8])),
      ]
      const _car = await encode(blocks, blocks.at(-1)?.cid)
      const car =
        sizeVariant === 'known'
          ? _car
          : {
              version: _car.version,
              roots: _car.roots,
              stream: () => _car.stream(),
            }
      const someBytes = new Uint8Array(await _car.arrayBuffer())
      const piece = Piece.fromPayload(someBytes).link

      /** @type {import('../src/types.js').PieceLink[]} */
      const pieceCIDs = []

      const proofs = await Promise.all([
        BlobCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        IndexCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
        UploadCapabilities.add.delegate({
          issuer: space,
          audience: agent,
          with: space.did(),
          expiration: Infinity,
        }),
      ])

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            // @ts-ignore Argument of type
            add: provide(BlobCapabilities.add, ({ capability, invocation }) => {
              assert.equal(invocation.issuer.did(), agent.did())
              assert.equal(invocation.capabilities.length, 1)
              assert.equal(capability.can, BlobCapabilities.add.can)
              assert.equal(capability.with, space.did())
              return setupBlobAddSuccessResponse(
                { issuer: space, audience: agent, with: space, proofs },
                invocation
              )
            }),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, piece, invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadCapabilities.add.can)
            assert.equal(invCap.with, space.did())
            if (!invCap.nb) throw new Error('nb must be present')
            assert.equal(invCap.nb.shards?.length, 1)
            return {
              ok: invCap.nb,
            }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })

      await uploadCAR(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        car,
        {
          connection,
          onShardStored: (meta) => {
            if (meta.piece) pieceCIDs.push(meta.piece)
          },
          receiptsEndpoint,
        }
      )

      assert(service.space.blob.add.called)
      assert.equal(service.space.blob.add.callCount, 2)
      assert(service.space.index.add.called)
      assert.equal(service.space.index.add.callCount, 1)
      assert(service.filecoin.offer.called)
      assert.equal(service.filecoin.offer.callCount, 1)
      assert(service.upload.add.called)
      assert.equal(service.upload.add.callCount, 1)
      assert.equal(pieceCIDs.length, 1)
      assert.equal(
        pieceCIDs[0].toString(),
        'bafkzcibcoibrsisrq3nrfmsxvynduf4kkf7qy33ip65w7ttfk7guyqod5w5mmei'
      )
    })

    it('generates invocation configuration on demand', async () => {
      const space = await Signer.generate()
      const agent = await Signer.generate() // The "user" that will ask the service to accept the upload
      const bytes = await randomBytes(128)
      const file = toBlob(bytes, sizeVariant)
      const expectedCar = await toCAR(bytes)
      const piece = Piece.fromPayload(bytes).link

      /** @type {import('../src/types.js').CARLink|undefined} */
      let carCID

      const service = mockService({
        ucan: {
          conclude: provide(UCAN.conclude, () => {
            return { ok: { time: Date.now() } }
          }),
        },
        space: {
          blob: {
            add: provide(
              BlobCapabilities.add,
              // @ts-ignore Argument of type
              async function ({ invocation, capability }) {
                assert.equal(invocation.issuer.did(), agent.did())
                assert.equal(invocation.capabilities.length, 1)
                assert.equal(capability.can, BlobCapabilities.add.can)
                assert.equal(capability.with, space.did())
                return setupBlobAddSuccessResponse(
                  { issuer: space, audience: agent, with: space },
                  invocation
                )
              }
            ),
          },
          index: {
            add: Server.provideAdvanced({
              capability: IndexCapabilities.add,
              handler: async ({ capability }) => {
                assert(capability.nb.index)
                return Server.ok({})
              },
            }),
          },
        },
        filecoin: {
          offer: Server.provideAdvanced({
            capability: StorefrontCapabilities.filecoinOffer,
            handler: async ({ invocation, context }) => {
              const invCap = invocation.capabilities[0]
              if (!invCap.nb) {
                throw new Error('no params received')
              }
              return getFilecoinOfferResponse(context.id, piece, invCap.nb)
            },
          }),
        },
        upload: {
          add: provide(UploadCapabilities.add, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadCapabilities.add.can)
            assert.equal(invCap.with, space.did())
            assert.equal(invCap.nb?.shards?.length, 1)
            assert.equal(String(invCap.nb?.shards?.[0]), carCID?.toString())
            return {
              ok: {
                root: expectedCar.roots[0],
                shards: [expectedCar.cid],
              },
            }
          }),
        },
      })

      const server = Server.create({
        id: serviceSigner,
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })
      const connection = Client.connect({
        id: serviceSigner,
        codec: CAR.outbound,
        channel: server,
      })
      const dataCID = await uploadFile(
        async (caps) => {
          const proofs = []
          for (const { can, nb } of caps) {
            if (can === BlobCapabilities.add.can) {
              proofs.push(
                await BlobCapabilities.add.delegate({
                  issuer: space,
                  audience: agent,
                  with: space.did(),
                  nb: /** @type {import('@storacha/capabilities/types').SpaceBlobAdd['nb']} */ (
                    nb
                  ),
                  expiration: Infinity,
                })
              )
            } else if (can === IndexCapabilities.add.can) {
              proofs.push(
                await IndexCapabilities.add.delegate({
                  issuer: space,
                  audience: agent,
                  with: space.did(),
                  nb: /** @type {import('@storacha/capabilities/types').SpaceIndexAdd['nb']} */ (
                    nb
                  ),
                  expiration: Infinity,
                })
              )
            } else if (can === UploadCapabilities.add.can) {
              proofs.push(
                await UploadCapabilities.add.delegate({
                  issuer: space,
                  audience: agent,
                  with: space.did(),
                  nb: /** @type {import('@storacha/capabilities/types').UploadAdd['nb']} */ (
                    nb
                  ),
                  expiration: Infinity,
                })
              )
            }
          }
          return {
            issuer: agent,
            with: space.did(),
            proofs,
            audience: serviceSigner,
          }
        },
        file,
        {
          connection,
          onShardStored: (meta) => {
            carCID = meta.cid
          },
          receiptsEndpoint,
        }
      )

      assert(service.space.blob.add.called)
      assert.equal(service.space.blob.add.callCount, 2)
      assert(service.filecoin.offer.called)
      assert.equal(service.filecoin.offer.callCount, 1)
      assert(service.space.index.add.called)
      assert.equal(service.space.index.add.callCount, 1)
      assert(service.upload.add.called)
      assert.equal(service.upload.add.callCount, 1)

      assert.equal(carCID?.toString(), expectedCar.cid.toString())
      assert.equal(dataCID.toString(), expectedCar.roots[0].toString())
    })
  })
}
