import { strict as assert } from 'node:assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as SpaceReplica from '../../../../src/space/replica/index.js'
import * as Capability from '../../../../src/top.js'
import {
  alice,
  service as storageNode,
  mallory as account,
} from '../../../helpers/fixtures.js'
import {
  createCar,
  validateAuthorization,
} from '../../../helpers/utils.js'

const top = () =>
  Capability.top.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
  })

const replica = async () =>
  SpaceReplica.replica.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
    proofs: [await top()],
  })

describe('space replica capabilities', function () {
  it('space/replica/list can be derived from *', async () => {
    const car = await createCar('test')

    const list = SpaceReplica.list.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [await top()],
    })

    const result = await access(await list.delegate(), {
      capability: SpaceReplica.list,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, SpaceReplica.list.can)
  })

  it('space/replica/list can be derived from space/replica/*', async () => {
    const car = await createCar('test')

    const list = SpaceReplica.list.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [await replica()],
    })

    const result = await access(await list.delegate(), {
      capability: SpaceReplica.list,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, SpaceReplica.list.can)
  })

  it('space/replica/list should fail when escalating space constraint', async () => {
    const car1 = await createCar('test1')
    const car2 = await createCar('test2')

    const list = await SpaceReplica.list.delegate({
      issuer: account,
      audience: alice,
      with: account.did(),
      nb: {
        blob: car1.cid.multihash.bytes,
      },
      proofs: [await top()],
    })

    const invalidList = SpaceReplica.list.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: car2.cid.multihash.bytes,
      },
    })

    const result = await access(await invalidList.delegate(), {
      capability: SpaceReplica.list,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
      proofs: [list],
    })

    assert.ok(!result.ok)
  })
})
