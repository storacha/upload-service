import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import { delegate } from '@ucanto/core'
import * as PDP from '../../src/pdp.js'
import {
  alice,
  bob,
  service as w3,
  mallory as account,
} from '../helpers/fixtures.js'
import { createCar, validateAuthorization } from '../helpers/utils.js'

describe('pdp capabilities', function () {
  // delegation from account to agent
  const any = delegate({
    issuer: account,
    audience: alice,
    capabilities: [
      {
        can: '*',
        with: account.did(),
      },
    ],
  })

  it('pdp/accept can be invoked with blob digest', async () => {
    const car = await createCar('test')

    const accept = PDP.accept.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [await any],
    })

    const result = await access(await accept.delegate(), {
      capability: PDP.accept,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'pdp/accept')
    assert.deepEqual(result.ok.capability.nb.blob, car.cid.multihash.bytes)
  })

  it('pdp/accept can be delegated', async () => {
    const car = await createCar('test')

    const delegation = await PDP.accept.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [await any],
    })

    const accept = PDP.accept.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [delegation],
    })

    const result = await access(await accept.delegate(), {
      capability: PDP.accept,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'pdp/accept')
  })

  it('pdp/accept should fail when escalating blob', async () => {
    const car1 = await createCar('test1')
    const car2 = await createCar('test2')

    const delegation = PDP.accept
      .invoke({
        issuer: alice,
        audience: bob,
        with: w3.did(),
        nb: {
          blob: car1.cid.multihash.bytes,
        },
        proofs: [await any],
      })
      .delegate()

    const accept = PDP.accept.invoke({
      issuer: bob,
      audience: w3,
      with: w3.did(),
      nb: {
        blob: car2.cid.multihash.bytes,
      },
      proofs: [await delegation],
    })

    const result = await access(await accept.delegate(), {
      capability: PDP.accept,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed blob constraint'))
  })

  it('pdp/accept capability requires with to be a did', async () => {
    const car = await createCar('test')

    assert.throws(() => {
      PDP.accept.invoke({
        issuer: alice,
        audience: w3,
        // @ts-expect-error - not a DID
        with: 'mailto:alice@web.mail',
        nb: {
          blob: car.cid.multihash.bytes,
        },
      })
    }, /Expected a did: but got "mailto:alice@web.mail" instead/)
  })

  it('pdp/accept validation requires with to be a did', async () => {
    const car = await createCar('test')
    const accept = await delegate({
      issuer: alice,
      audience: w3,
      capabilities: [
        {
          can: 'pdp/accept',
          with: 'mailto:alice@web.mail',
          nb: {
            blob: car.cid.multihash.bytes,
          },
        },
      ],
      proofs: [await any],
    })

    // @ts-expect-error - testing with invalid delegation
    const result = await access(accept, {
      capability: PDP.accept,
      principal: Verifier,
      authority: w3,
    })

    assert.ok(result.error)
    assert(
      result.error.message.includes(
        'Expected a did: but got "mailto:alice@web.mail" instead'
      )
    )
  })

  it('pdp/info can be invoked with blob digest', async () => {
    const car = await createCar('test')

    const info = PDP.info.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [await any],
    })

    const result = await access(await info.delegate(), {
      capability: PDP.info,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'pdp/info')
    assert.deepEqual(result.ok.capability.nb.blob, car.cid.multihash.bytes)
  })

  it('pdp/info can be delegated', async () => {
    const car = await createCar('test')

    const delegation = await PDP.info.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [await any],
    })

    const info = PDP.info.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [delegation],
    })

    const result = await access(await info.delegate(), {
      capability: PDP.info,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'pdp/info')
  })

  it('pdp/info should fail when escalating blob', async () => {
    const car1 = await createCar('test1')
    const car2 = await createCar('test2')

    const delegation = PDP.info
      .invoke({
        issuer: alice,
        audience: bob,
        with: account.did(),
        nb: {
          blob: car1.cid.multihash.bytes,
        },
        proofs: [await any],
      })
      .delegate()

    const info = PDP.info.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        blob: car2.cid.multihash.bytes,
      },
      proofs: [await delegation],
    })

    const result = await access(await info.delegate(), {
      capability: PDP.info,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed blob constraint'))
  })

  it('pdp/info capability requires with to be a did', async () => {
    const car = await createCar('test')

    assert.throws(() => {
      PDP.info.invoke({
        issuer: alice,
        audience: w3,
        // @ts-expect-error - not a DID
        with: 'mailto:alice@web.mail',
        nb: {
          blob: car.cid.multihash.bytes,
        },
      })
    }, /Expected a did: but got "mailto:alice@web.mail" instead/)
  })

  it('pdp/info validation requires with to be a did', async () => {
    const car = await createCar('test')
    const info = await delegate({
      issuer: alice,
      audience: w3,
      capabilities: [
        {
          can: 'pdp/info',
          with: 'mailto:alice@web.mail',
          nb: {
            blob: car.cid.multihash.bytes,
          },
        },
      ],
      proofs: [await any],
    })

    // @ts-expect-error - testing with invalid delegation
    const result = await access(info, {
      capability: PDP.info,
      principal: Verifier,
      authority: w3,
    })

    assert.ok(result.error)
    assert(
      result.error.message.includes(
        'Expected a did: but got "mailto:alice@web.mail" instead'
      )
    )
  })

  it('pdp/info should work when blob not constrained in delegation', async () => {
    const car = await createCar('test')

    const delegation = await PDP.info.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await any],
    })

    const info = PDP.info.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        blob: car.cid.multihash.bytes,
      },
      proofs: [delegation],
    })

    const result = await access(await info.delegate(), {
      capability: PDP.info,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'pdp/info')
    assert.deepEqual(result.ok.capability.nb.blob, car.cid.multihash.bytes)
  })
})
