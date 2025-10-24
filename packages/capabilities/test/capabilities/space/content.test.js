import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import { Delegation } from '@ucanto/core'
import * as SpaceContent from '../../../src/space/content.js'
import * as Capability from '../../../src/top.js'
import { alice, bob, service, mallory as space } from '../../helpers/fixtures.js'
import { createCar, validateAuthorization } from '../../helpers/utils.js'

const top = () =>
  Capability.top.delegate({
    issuer: space,
    audience: alice,
    with: space.did(),
  })

const content = async () =>
  SpaceContent.content.delegate({
    issuer: space,
    audience: alice,
    with: space.did(),
    proofs: [await top()],
  })

describe('space/content capabilities', function () {
  it('space/content/retrieve can be derived from *', async () => {
    const car = await createCar('test')

    const retrieve = SpaceContent.retrieve.invoke({
      issuer: alice,
      audience: service,
      with: space.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
        },
        range: [0, car.bytes.length - 1],
      },
      proofs: [await top()],
    })

    const result = await access(await retrieve.delegate(), {
      capability: SpaceContent.retrieve,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, SpaceContent.retrieve.can)
  })

  it('space/content/retrieve can be derived from space/blob/*', async () => {
    const car = await createCar('test')

    const retrieve = SpaceContent.retrieve.invoke({
      issuer: alice,
      audience: service,
      with: space.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
        },
        range: [0, car.bytes.length - 1],
      },
      proofs: [await content()],
    })

    const result = await access(await retrieve.delegate(), {
      capability: SpaceContent.retrieve,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, SpaceContent.retrieve.can)
  })

  it('space/content/retrieve can be derived from space/content/* derived from *', async () => {
    const car = await createCar('test')

    const content = await SpaceContent.content.delegate({
      issuer: alice,
      audience: bob,
      with: space.did(),
      proofs: [await top()],
    })

    const retrieve = SpaceContent.retrieve.invoke({
      issuer: bob,
      audience: service,
      with: space.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
        },
        range: [0, car.bytes.length - 1],
      },
      proofs: [content],
    })

    const result = await access(await retrieve.delegate(), {
      capability: SpaceContent.retrieve,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, SpaceContent.retrieve.can)
  })

  it('space/content/retrieve should fail when escalating blob digest constraint', async () => {
    const car = await createCar('test')
    const car2 = await createCar('test2')

    const proof = await SpaceContent.retrieve.delegate({
      issuer: alice,
      audience: bob,
      with: space.did(),
      nb: {
        blob: { digest: car.cid.multihash.bytes }
      },
      proofs: [await top()],
    })

    const retrieve = await Delegation.delegate({
      issuer: bob,
      audience: service,
      capabilities: [{
        can: SpaceContent.retrieve.can,
        with: space.did(),
        nb: {
          blob: { digest: car2.cid.multihash.bytes },
          range: [0, 100]
        }
      }],
      proofs: [proof]
    })

    const result = await access(retrieve, {
      capability: SpaceContent.retrieve,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.error)
    assert(result.error.message.includes('Constraint violation: digest'))
  })

  it('space/content/retrieve should fail when escalating byte range constraint', async () => {
    const car = await createCar('test')

    const proof = await SpaceContent.retrieve.delegate({
      issuer: alice,
      audience: bob,
      with: space.did(),
      nb: {
        range: [1, 100],
      },
      proofs: [await top()],
    })

    const cases = [
      {range: [0, 100], message: 'Constraint violation: byte range'},
      {range: [0, 100], message: 'Constraint violation: byte range'},
      {range: undefined, message: 'invalid field "range"'},
    ]

    for (const { range, message } of cases) {
      const retrieve = await Delegation.delegate({
        issuer: bob,
        audience: service,
        capabilities: [{
          can: SpaceContent.retrieve.can,
          with: space.did(),
          nb: {
            blob: { digest: car.cid.multihash.bytes },
          ...(range ? { range } : {})
          }
        }],
        proofs: [proof]
      })

      const result = await access(retrieve, {
        capability: SpaceContent.retrieve,
        principal: Verifier,
        authority: service,
        validateAuthorization,
      })
      assert.ok(result.error)
      assert(result.error.message.includes(message))
    }
  })
})
