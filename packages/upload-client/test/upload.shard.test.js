import assert from 'assert'
import * as Client from '@ucanto/client'
import * as Server from '@ucanto/server'
import { provide } from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import * as Signer from '@ucanto/principal/ed25519'
import * as UploadShardCapabilities from '@storacha/capabilities/upload/shard'
import * as UploadShard from '../src/upload/shard/index.js'
import { serviceSigner } from './fixtures.js'
import { randomCAR } from './helpers/random.js'
import { mockService } from './helpers/mocks.js'
import { validateAuthorization } from './helpers/utils.js'

describe('UploadShard.list', () => {
  it('lists upload shards', async () => {
    const space = await Signer.generate()
    const agent = await Signer.generate()

    const car = await randomCAR(128)
    const res = {
      cursor: 'test',
      size: 1000,
      results: [car.cid],
    }
    const proofs = [
      await UploadShardCapabilities.list.delegate({
        issuer: space,
        audience: agent,
        with: space.did(),
        expiration: Infinity,
      }),
    ]

    const service = mockService({
      upload: {
        shard: {
          list: provide(UploadShardCapabilities.list, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadShardCapabilities.list.can)
            assert.equal(invCap.with, space.did())
            return { ok: res }
          }),
        },
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

    const list = await UploadShard.list(
      { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
      car.cid,
      { connection }
    )

    assert(service.upload.shard.list.called)
    assert.equal(service.upload.shard.list.callCount, 1)

    assert.equal(list.cursor, res.cursor)
    assert.equal(list.size, res.size)
    assert(list.results)
    assert.equal(list.results.length, res.results.length)
    list.results.forEach((r, i) => {
      assert.equal(r.toString(), res.results[i].toString())
    })
  })

  it('paginates', async () => {
    const space = await Signer.generate()
    const agent = await Signer.generate()

    const cursor = 'test'
    const car0 = await randomCAR(128)
    const page0 = {
      cursor,
      size: 1,
      results: [car0.cid],
    }
    const car1 = await randomCAR(128)
    const page1 = {
      size: 1,
      results: [car1.cid],
    }
    const proofs = [
      await UploadShardCapabilities.list.delegate({
        issuer: space,
        audience: agent,
        with: space.did(),
        expiration: Infinity,
      }),
    ]

    const service = mockService({
      upload: {
        shard: {
          list: provide(UploadShardCapabilities.list, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, UploadShardCapabilities.list.can)
            assert.equal(invCap.with, space.did())
            assert.equal(invCap.nb?.size, 1)
            return {
              ok: invCap.nb?.cursor === cursor ? page1 : page0,
            }
          }),
        },
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

    const results0 = await UploadShard.list(
      { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
      car0.roots[0],
      { size: 1, connection }
    )
    const results1 = await UploadShard.list(
      { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
      car0.roots[0],
      { size: 1, cursor: results0.cursor, connection }
    )

    assert(service.upload.shard.list.called)
    assert.equal(service.upload.shard.list.callCount, 2)

    assert.equal(results0.cursor, page0.cursor)
    assert.equal(results0.size, page0.size)
    assert(results0.results)
    assert.equal(results0.results.length, page0.results.length)
    results0.results.forEach((r, i) => {
      assert.equal(r.toString(), page0.results[i].toString())
    })

    assert.equal(results1.cursor, undefined)
    assert.equal(results1.size, page1.size)
    assert(results1.results)
    assert.equal(results1.results.length, page1.results.length)
    results1.results.forEach((r, i) => {
      assert.equal(r.toString(), page1.results[i].toString())
    })
  })

  it('throws on service error', async () => {
    const space = await Signer.generate()
    const agent = await Signer.generate()
    const car = await randomCAR(128)

    const proofs = [
      await UploadShardCapabilities.list.delegate({
        issuer: space,
        audience: agent,
        with: space.did(),
        expiration: Infinity,
      }),
    ]

    const service = mockService({
      upload: {
        shard: {
          list: provide(UploadShardCapabilities.list, () => {
            throw new Server.Failure('boom')
          }),
        },
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

    await assert.rejects(
      UploadShard.list(
        { issuer: agent, with: space.did(), proofs, audience: serviceSigner },
        car.roots[0],
        { connection }
      ),
      {
        message: 'failed upload/shard/list invocation',
      }
    )
  })
})
