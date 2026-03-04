import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import { Delegation } from '@ucanto/core'
import * as UploadShard from '../../../src/upload/shard.js'
import * as Capability from '../../../src/top.js'
import {
  alice,
  bob,
  service,
  mallory as space,
} from '../../helpers/fixtures.js'
import { createCar, validateAuthorization } from '../../helpers/utils.js'

const top = () =>
  Capability.top.delegate({
    issuer: space,
    audience: alice,
    with: space.did(),
  })

const shard = async () =>
  UploadShard.shard.delegate({
    issuer: space,
    audience: alice,
    with: space.did(),
    proofs: [await top()],
  })

describe('upload/shard capabilities', () => {
  it('upload/shard/list can be derived from *', async () => {
    const car = await createCar('test')

    const list = UploadShard.list.invoke({
      issuer: alice,
      audience: service,
      with: space.did(),
      nb: {
        root: car.cid,
      },
      proofs: [await top()],
    })

    const result = await access(await list.delegate(), {
      capability: UploadShard.list,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, UploadShard.list.can)
  })

  it('upload/shard/list can be derived from upload/shard/*', async () => {
    const car = await createCar('test')

    const list = UploadShard.list.invoke({
      issuer: alice,
      audience: service,
      with: space.did(),
      nb: {
        root: car.cid,
      },
      proofs: [await shard()],
    })

    const result = await access(await list.delegate(), {
      capability: UploadShard.list,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, UploadShard.list.can)
  })

  it('upload/shard/list can be derived from upload/shard/* derived from *', async () => {
    const car = await createCar('test')

    const shard = await UploadShard.shard.delegate({
      issuer: alice,
      audience: bob,
      with: space.did(),
      proofs: [await top()],
    })

    const list = UploadShard.list.invoke({
      issuer: bob,
      audience: service,
      with: space.did(),
      nb: {
        root: car.cid,
      },
      proofs: [shard],
    })

    const result = await access(await list.delegate(), {
      capability: UploadShard.list,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, UploadShard.list.can)
  })

  it('upload/shard/list should fail when escalating root constraint', async () => {
    const car = await createCar('test')
    const car2 = await createCar('test2')

    const proof = await UploadShard.list.delegate({
      issuer: alice,
      audience: bob,
      with: space.did(),
      nb: {
        root: car.cid,
      },
      proofs: [await top()],
    })

    const list = await Delegation.delegate({
      issuer: bob,
      audience: service,
      capabilities: [
        {
          can: UploadShard.list.can,
          with: space.did(),
          nb: {
            root: car2.cid,
          },
        },
      ],
      proofs: [proof],
    })

    const result = await access(list, {
      // @ts-expect-error link type mismatch
      capability: UploadShard.list,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed root constraint'))
  })
})
