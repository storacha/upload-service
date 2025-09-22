import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as AccountUsage from '../../../src/account/usage.js'
import * as Capability from '../../../src/top.js'
import {
  alice,
  service,
  bobAccount as account,
  mallory,
  space,
  bob,
} from '../../helpers/fixtures.js'
import {
  delegateWithAttestation,
  validateAuthorization,
} from '../../helpers/utils.js'

const top = () =>
  delegateWithAttestation(Capability.top, {
    account: account.did(),
    service,
    audience: alice,
    with: account.did(),
  })

const accountUsage = () =>
  delegateWithAttestation(AccountUsage.accountUsage, {
    account: account.did(),
    service,
    audience: alice,
    with: account.did(),
  })

describe('account/usage/get capabilities', function () {
  it('account/usage/get can be derived can be derived from *', async () => {
    const get = AccountUsage.get.invoke({
      issuer: alice,
      audience: service,
      with: account.did(),
      nb: {},
      proofs: await top(),
    })

    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountUsage.get.can)
  })

  it('account/usage/get can be derived can be derived from account/usage/*', async () => {
    const get = AccountUsage.get.invoke({
      issuer: alice,
      audience: service,
      with: account.did(),
      nb: {},
      proofs: await accountUsage(),
    })
    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountUsage.get.can)
  })

  it('account/usage/get should fail when escalating period constraint', async () => {
    const period = { from: 5, to: 6 }
    const delegation = await AccountUsage.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { period },
      proofs: await top(),
    })

    {
      const get = AccountUsage.get.invoke({
        issuer: mallory,
        audience: service,
        with: account.did(),
        nb: { period: { from: period.from + 1, to: period.to } },
        proofs: [delegation],
      })

      const result = await access(await get.delegate(), {
        capability: AccountUsage.get,
        principal: Verifier,
        authority: service,
        validateAuthorization,
      })

      assert.ok(result.error)
      assert(
        result.error.message.includes(
          `${period.from + 1} violates imposed period.from constraint ${
            period.from
          }`
        )
      )
    }

    {
      const get = AccountUsage.get.invoke({
        issuer: mallory,
        audience: service,
        with: account.did(),
        nb: { period: { from: period.from, to: period.to + 1 } },
        proofs: [delegation],
      })

      const result = await access(await get.delegate(), {
        capability: AccountUsage.get,
        principal: Verifier,
        authority: service,
        validateAuthorization,
      })

      assert.ok(result.error)
      assert(
        result.error.message.includes(
          `${period.to + 1} violates imposed period.to constraint ${period.to}`
        )
      )
    }
  })

  it('account/usage/get period from must be an int', async () => {
    const period = { from: 5.5, to: 6 }
    const proofs = await top()
    assert.throws(() => {
      AccountUsage.get.invoke({
        issuer: alice,
        audience: service,
        with: account.did(),
        nb: { period },
        proofs,
      })
    }, /Expected value of type integer instead got 5\.5/)
  })

  it('account/usage/get period to must be an int', async () => {
    const period = { from: 5, to: 6.6 }
    const proofs = await top()
    assert.throws(() => {
      AccountUsage.get.invoke({
        issuer: alice,
        audience: service,
        with: account.did(),
        nb: { period },
        proofs,
      })
    }, /Expected value of type integer instead got 6\.6/)
  })

  it('account/usage/get succeeds when spaces are equal in delegation and invocation', async () => {
    const spaces = [space.did()]
    const delegation = await AccountUsage.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces },
      proofs: await top(),
    })

    const get = AccountUsage.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountUsage.get.can)
    assert.deepEqual(result.ok.capability.nb, { spaces })
  })

  it('account/usage/get succeeds when delegation has no spaces constraint but invocation specifies spaces', async () => {
    const delegation = await AccountUsage.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: {},
      proofs: await top(),
    })

    const spaces = [space.did()]
    const get = AccountUsage.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountUsage.get.can)
    assert.deepEqual(result.ok.capability.nb, { spaces })
  })

  it('account/usage/get should fail when delegation has spaces constraint but invocation asks for all spaces', async () => {
    const spaces = [space.did()]
    const delegation = await AccountUsage.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces },
      proofs: await top(),
    })

    const get = AccountUsage.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: {},
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(
      result.error.message.includes(
        `Constraint violation: violates imposed spaces constraint ${spaces} because it asks for all spaces`
      )
    )
  })

  it('account/usage/get succeeds when invocation asks for subset of delegation spaces', async () => {
    const delegationSpaces = [space.did(), bob.did()]
    const delegation = await AccountUsage.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces: delegationSpaces },
      proofs: await top(),
    })

    const invocationSpaces = [space.did()]
    const get = AccountUsage.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces: invocationSpaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountUsage.get.can)
    assert.deepEqual(result.ok.capability.nb, { spaces: invocationSpaces })
  })

  it('account/usage/get should fail when invocation asks for spaces not in delegation constraint', async () => {
    const delegationSpaces = [space.did()]
    const delegation = await AccountUsage.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces: delegationSpaces },
      proofs: await top(),
    })

    const invocationSpaces = [space.did(), bob.did()]
    const get = AccountUsage.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces: invocationSpaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountUsage.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.error)
    assert(
      result.error.message.includes(
        `Constraint violation: ${invocationSpaces} violates imposed spaces constraint ${delegationSpaces} because it contains items not in the constraint`
      )
    )
  })
})
