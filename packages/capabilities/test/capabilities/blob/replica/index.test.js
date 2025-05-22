import assert from 'assert'
import { access } from '@ucanto/validator'
import { ed25519, Verifier } from '@ucanto/principal'
import * as DID from '@ipld/dag-ucan/did'
import * as BlobReplica from '../../../../src/blob/replica/index.js'
import * as Capability from '../../../../src/top.js'
import {
  alice,
  service as storageNode,
  mallory as account,
  bob,
} from '../../../helpers/fixtures.js'
import {
  createCar,
  createCborCid,
  validateAuthorization,
} from '../../../helpers/utils.js'

const top = () =>
  Capability.top.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
  })

const replica = async () =>
  BlobReplica.replica.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
    proofs: [await top()],
  })

describe('blob replica capabilities', function () {
  it('blob/replica/allocate can be derived from *', async () => {
    const space = await ed25519.generate()
    const car = await createCar('test')

    const allocate = BlobReplica.allocate.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [await top()],
    })

    const result = await access(await allocate.delegate(), {
      capability: BlobReplica.allocate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, BlobReplica.allocate.can)
  })

  it('blob/replica/allocate can be derived from blob/replica/*', async () => {
    const space = await ed25519.generate()
    const car = await createCar('test')

    const allocate = BlobReplica.allocate.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [await replica()],
    })

    const result = await access(await allocate.delegate(), {
      capability: BlobReplica.allocate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, BlobReplica.allocate.can)
  })

  it('blob/replica/allocate can be derived from blob/replica/* derived from *', async () => {
    const space = await ed25519.generate()
    const car = await createCar('test')

    const replica = await BlobReplica.replica.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const allocate = BlobReplica.allocate.invoke({
      issuer: bob,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [replica],
    })

    const result = await access(await allocate.delegate(), {
      capability: BlobReplica.allocate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, BlobReplica.allocate.can)
  })

  it('blob/replica/allocate should fail when escalating space constraint', async () => {
    const space0 = await ed25519.generate()
    const space1 = await ed25519.generate()
    const car = await createCar('test')

    const blob = await BlobReplica.allocate.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        space: DID.parse(space0.did()),
      },
      proofs: [await top()],
    })

    const allocate = BlobReplica.allocate.invoke({
      issuer: bob,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space1.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [blob],
    })

    const result = await access(await allocate.delegate(), {
      capability: BlobReplica.allocate,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed space constraint'))
  })

  it('blob/replica/transfer can be derived from *', async () => {
    const space = await ed25519.generate()
    const car = await createCar('test')

    const transfer = BlobReplica.transfer.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [await top()],
    })

    const result = await access(await transfer.delegate(), {
      capability: BlobReplica.transfer,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, BlobReplica.transfer.can)
  })

  it('blob/replica/transfer can be derived from blob/replica/*', async () => {
    const space = await ed25519.generate()
    const car = await createCar('test')

    const transfer = BlobReplica.transfer.invoke({
      issuer: alice,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [await replica()],
    })

    const result = await access(await transfer.delegate(), {
      capability: BlobReplica.transfer,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, BlobReplica.transfer.can)
  })

  it('blob/replica/transfer can be derived from blob/replica/* derived from *', async () => {
    const space = await ed25519.generate()
    const car = await createCar('test')

    const blob = await BlobReplica.transfer.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const accept = BlobReplica.transfer.invoke({
      issuer: bob,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [blob],
    })

    const result = await access(await accept.delegate(), {
      capability: BlobReplica.transfer,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), storageNode.did())
    assert.equal(result.ok.capability.can, BlobReplica.transfer.can)
  })

  it('blob/replica/transfer should fail when escalating space constraint', async () => {
    const space0 = await ed25519.generate()
    const space1 = await ed25519.generate()
    const car = await createCar('test')

    const blob = await BlobReplica.transfer.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        space: DID.parse(space0.did()),
      },
      proofs: [await top()],
    })

    const accept = BlobReplica.transfer.invoke({
      issuer: bob,
      audience: storageNode,
      with: account.did(),
      nb: {
        blob: {
          digest: car.cid.multihash.bytes,
          size: car.bytes.length,
        },
        space: DID.parse(space1.did()),
        site: await createCborCid({ now: Date.now() }),
        cause: await createCborCid({ now: Date.now() }),
      },
      proofs: [blob],
    })

    const result = await access(await accept.delegate(), {
      capability: BlobReplica.transfer,
      principal: Verifier,
      authority: storageNode,
      validateAuthorization,
    })
    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed space constraint'))
  })
})
