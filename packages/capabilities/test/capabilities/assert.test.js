import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as Assert from '../../src/assert.js'
import * as Top from '../../src/top.js'
import {
  alice,
  service as w3,
  mallory as account,
  bob,
} from '../helpers/fixtures.js'
import {
  createCborCid,
  createCarCid,
  validateAuthorization,
} from '../helpers/utils.js'

const top = async () =>
  Top.top.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
  })

const assertTop = async () =>
  Assert.assert.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
    proofs: [await top()],
  })

describe('assert capabilities', function () {
  it('assert/equals can be derived from *', async () => {
    const equals = Assert.equals.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        equals: await createCarCid('equivalent'),
      },
      proofs: [await top()],
    })

    const result = await access(await equals.delegate(), {
      capability: Assert.equals,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/equals')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCarCid('test'),
      equals: await createCarCid('equivalent'),
    })
  })

  it('assert/equals can be derived from assert/*', async () => {
    const equals = Assert.equals.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        equals: await createCarCid('equivalent'),
      },
      proofs: [await assertTop()],
    })

    const result = await access(await equals.delegate(), {
      capability: Assert.equals,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/equals')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCarCid('test'),
      equals: await createCarCid('equivalent'),
    })
  })

  it('assert/equals can be derived from assert/* derived from *', async () => {
    const assertTop = await Assert.assert.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const equals = Assert.equals.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        equals: await createCarCid('equivalent'),
      },
      proofs: [assertTop],
    })

    const result = await access(await equals.delegate(), {
      capability: Assert.equals,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/equals')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCarCid('test'),
      equals: await createCarCid('equivalent'),
    })
  })

  it('assert/equals should fail when escalating content constraint', async () => {
    const delegation = await Assert.equals.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        equals: await createCarCid('equivalent'),
      },
      proofs: [await top()],
    })

    const equals = Assert.equals.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test2'),
        equals: await createCarCid('equivalent'),
      },
      proofs: [delegation],
    })

    const result = await access(await equals.delegate(), {
      capability: Assert.equals,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed content constraint'))
  })

  it('assert/equals should fail when escalating equals constraint', async () => {
    const delegation = await Assert.equals.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        equals: await createCarCid('equivalent'),
      },
      proofs: [await top()],
    })

    const equals = Assert.equals.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        equals: await createCarCid('equivalent2'),
      },
      proofs: [delegation],
    })

    const result = await access(await equals.delegate(), {
      capability: Assert.equals,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed equals constraint'))
  })

  it('assert/location can be derived from *', async () => {
    const site = Assert.location.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
      },
      proofs: [await top()],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/location')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCarCid('test'),
      location: ['http://localhost/'],
    })
  })

  it('assert/location can be derived from assert/*', async () => {
    const site = Assert.location.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
      },
      proofs: [await assertTop()],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/location')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCarCid('test'),
      location: ['http://localhost/'],
    })
  })

  it('assert/location can be derived from assert/* derived from *', async () => {
    const assertTop = await Assert.assert.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const site = Assert.location.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
      },
      proofs: [assertTop],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/location')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCarCid('test'),
      location: ['http://localhost/'],
    })
  })

  it('assert/location should fail when escalating content constraint', async () => {
    const delegation = await Assert.location.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
      },
      proofs: [await top()],
    })

    const site = Assert.location.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test2'),
        location: ['http://localhost/'],
      },
      proofs: [delegation],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed content constraint'))
  })

  it('assert/location should fail when escalating location constraint', async () => {
    const delegation = await Assert.location.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
      },
      proofs: [await top()],
    })

    const site = Assert.location.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost:3000/'],
      },
      proofs: [delegation],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(
      result.error.message.includes('violates imposed location constraint')
    )
  })

  it('assert/location should fail when escalating range offset constraint', async () => {
    const delegation = await Assert.location.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
        range: { offset: 123, length: 456 },
      },
      proofs: [await top()],
    })

    const site = Assert.location.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
        range: { offset: 120, length: 456 },
      },
      proofs: [delegation],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed offset constraint'))
  })

  it('assert/location should fail when escalating range length constraint', async () => {
    const delegation = await Assert.location.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
        range: { offset: 123, length: 456 },
      },
      proofs: [await top()],
    })

    const site = Assert.location.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCarCid('test'),
        location: ['http://localhost/'],
        range: { offset: 123, length: 457 },
      },
      proofs: [delegation],
    })

    const result = await access(await site.delegate(), {
      capability: Assert.location,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed length constraint'))
  })

  it('assert/index can be derived from *', async () => {
    const index = Assert.index.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCborCid('test'),
        index: await createCarCid('index'),
      },
      proofs: [await top()],
    })

    const result = await access(await index.delegate(), {
      capability: Assert.index,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/index')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCborCid('test'),
      index: await createCarCid('index'),
    })
  })

  it('assert/index can be derived from assert/*', async () => {
    const index = Assert.index.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCborCid('test'),
        index: await createCarCid('index'),
      },
      proofs: [await assertTop()],
    })

    const result = await access(await index.delegate(), {
      capability: Assert.index,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/index')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCborCid('test'),
      index: await createCarCid('index'),
    })
  })

  it('assert/index can be derived from assert/* derived from *', async () => {
    const assertTop = await Assert.assert.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const index = Assert.index.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCborCid('test'),
        index: await createCarCid('index'),
      },
      proofs: [assertTop],
    })

    const result = await access(await index.delegate(), {
      capability: Assert.index,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'assert/index')
    assert.deepEqual(result.ok.capability.nb, {
      content: await createCborCid('test'),
      index: await createCarCid('index'),
    })
  })

  it('assert/index should fail when escalating content constraint', async () => {
    const delegation = await Assert.index.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCborCid('test'),
        index: await createCarCid('index'),
      },
      proofs: [await top()],
    })

    const index = Assert.index.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCborCid('test2'),
        index: await createCarCid('index'),
      },
      proofs: [delegation],
    })

    const result = await access(await index.delegate(), {
      capability: Assert.index,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed content constraint'))
  })

  it('assert/index should fail when escalating index constraint', async () => {
    const delegation = await Assert.index.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        content: await createCborCid('test'),
        index: await createCarCid('index'),
      },
      proofs: [await top()],
    })

    const index = Assert.index.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        content: await createCborCid('test'),
        index: await createCarCid('index2'),
      },
      proofs: [delegation],
    })

    const result = await access(await index.delegate(), {
      capability: Assert.index,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed index constraint'))
  })
})
