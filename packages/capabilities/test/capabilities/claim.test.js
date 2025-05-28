import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as Claim from '../../src/claim.js'
import * as Top from '../../src/top.js'
import {
  alice,
  service as w3,
  mallory as account,
  bob,
} from '../helpers/fixtures.js'
import { createCborCid, validateAuthorization } from '../helpers/utils.js'

const top = async () =>
  Top.top.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
  })

const claimTop = async () =>
  Claim.claim.delegate({
    issuer: account,
    audience: alice,
    with: account.did(),
    proofs: [await top()],
  })

describe('claim capabilities', function () {
  it('claim/cache can be derived from *', async () => {
    const equals = Claim.cache.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        claim: await createCborCid('test'),
        provider: { addresses: [new Uint8Array([1, 2, 3])] },
      },
      proofs: [await top()],
    })

    const result = await access(await equals.delegate(), {
      capability: Claim.cache,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'claim/cache')
    assert.deepEqual(result.ok.capability.nb, {
      claim: await createCborCid('test'),
      provider: { addresses: [new Uint8Array([1, 2, 3])] },
    })
  })

  it('claim/cache can be derived from claim/*', async () => {
    const equals = Claim.cache.invoke({
      issuer: alice,
      audience: w3,
      with: account.did(),
      nb: {
        claim: await createCborCid('test'),
        provider: { addresses: [new Uint8Array([1, 2, 3])] },
      },
      proofs: [await claimTop()],
    })

    const result = await access(await equals.delegate(), {
      capability: Claim.cache,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'claim/cache')
    assert.deepEqual(result.ok.capability.nb, {
      claim: await createCborCid('test'),
      provider: { addresses: [new Uint8Array([1, 2, 3])] },
    })
  })

  it('claim/cache can be derived from claim/* derived from *', async () => {
    const assertTop = await Claim.claim.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      proofs: [await top()],
    })

    const equals = Claim.cache.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        claim: await createCborCid('test'),
        provider: { addresses: [new Uint8Array([1, 2, 3])] },
      },
      proofs: [assertTop],
    })

    const result = await access(await equals.delegate(), {
      capability: Claim.cache,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    if (result.error) {
      assert.fail(result.error.message)
    }

    assert.deepEqual(result.ok.audience.did(), w3.did())
    assert.equal(result.ok.capability.can, 'claim/cache')
    assert.deepEqual(result.ok.capability.nb, {
      claim: await createCborCid('test'),
      provider: { addresses: [new Uint8Array([1, 2, 3])] },
    })
  })

  it('claim/cache should fail when escalating claim constraint', async () => {
    const delegation = await Claim.cache.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        claim: await createCborCid('test'),
        provider: { addresses: [new Uint8Array([1, 2, 3])] },
      },
      proofs: [await top()],
    })

    const equals = Claim.cache.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        claim: await createCborCid('test2'),
        provider: { addresses: [new Uint8Array([1, 2, 3])] },
      },
      proofs: [delegation],
    })

    const result = await access(await equals.delegate(), {
      capability: Claim.cache,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('violates imposed claim constraint'))
  })

  it('claim/cache should fail when escalating provider addresses constraint', async () => {
    const delegation = await Claim.cache.delegate({
      issuer: alice,
      audience: bob,
      with: account.did(),
      nb: {
        claim: await createCborCid('test'),
        provider: { addresses: [new Uint8Array([1, 2, 3])] },
      },
      proofs: [await top()],
    })

    const equals = Claim.cache.invoke({
      issuer: bob,
      audience: w3,
      with: account.did(),
      nb: {
        claim: await createCborCid('test'),
        provider: { addresses: [new Uint8Array([4, 5, 6])] },
      },
      proofs: [delegation],
    })

    const result = await access(await equals.delegate(), {
      capability: Claim.cache,
      principal: Verifier,
      authority: w3,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(result.error.message.includes('is not an allowed provider address'))
  })
})
