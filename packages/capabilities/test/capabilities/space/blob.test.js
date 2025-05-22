import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as SpaceBlob from '../../../src/space/blob.js'
import * as Capability from '../../../src/top.js'
import {
  alice,
  service as storageNode,
  mallory as account,
  bob,
} from '../../helpers/fixtures.js'
import {
  createCar,
  createCborCid,
  validateAuthorization,
} from '../../helpers/utils.js'

const top = () =>
  Capability.top.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
  })

const blob = async () =>
  SpaceBlob.blob.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
    proofs: [await top()],
  })

describe('space/blob capabilities', function () {
  it('space/blob/replicate can be derived from *', async () => {
    const car = await createCar('test')

    const replicate = SpaceBlob.replicate.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        replicas: 2,
        site: await createCborCid({ now: Date.now() }),
      },
      proofs: [await top()],
    })

    const result = await access(await replicate.delegate(), {
      capability: SpaceBlob.replicate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, SpaceBlob.replicate.can)
  })

  it('space/blob/replicate can be derived from space/blob/*', async () => {
    const car = await createCar('test')

    const replicate = SpaceBlob.replicate.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        replicas: 2,
        site: await createCborCid({ now: Date.now() }),
      },
      proofs: [await blob()],
    })

    const result = await access(await replicate.delegate(), {
      capability: SpaceBlob.replicate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, SpaceBlob.replicate.can)
  })

  it('space/blob/replicate can be derived from blob/* derived from *', async () => {
    const car = await createCar('test')

    const blob = await SpaceBlob.blob.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const replicate = SpaceBlob.replicate.invoke({
      issuer: bob,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        replicas: 1,
        site: await createCborCid({ now: Date.now() }),
      },
      proofs: [blob],
    })

    const result = await access(await replicate.delegate(), {
      capability: SpaceBlob.replicate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, SpaceBlob.replicate.can)
  })

  it('space/blob/replicate should fail when escalating replicas constraint', async () => {
    const car = await createCar('test')

    const blob = await SpaceBlob.replicate.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        replicas: 2,
      },
      proofs: [await top()],
    })

    const replicate = SpaceBlob.replicate.invoke({
      issuer: bob,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        replicas: 3,
        site: await createCborCid({ now: Date.now() }),
      },
      proofs: [blob],
    })

    const result = await access(await replicate.delegate(), {
      capability: SpaceBlob.replicate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.error)
    assert(
      result.error.message.includes('violates imposed replicas constraint')
    )
  })
})
