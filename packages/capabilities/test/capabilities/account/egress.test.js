import assert from 'assert'
import { access } from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as AccountEgress from '../../../src/account/egress.js'
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

const accountEgress = () =>
  delegateWithAttestation(AccountEgress.accountEgress, {
    account: account.did(),
    service,
    audience: alice,
    with: account.did(),
  })

describe('account/egress/get capabilities', function () {
  it('account/egress/get can be derived from *', async () => {
    const get = AccountEgress.get.invoke({
      issuer: alice,
      audience: service,
      with: account.did(),
      nb: {},
      proofs: await top(),
    })

    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })
    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountEgress.get.can)
  })

  it('account/egress/get can be derived from account/egress/*', async () => {
    const get = AccountEgress.get.invoke({
      issuer: alice,
      audience: service,
      with: account.did(),
      nb: {},
      proofs: await accountEgress(),
    })
    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountEgress.get.can)
  })

  it('account/egress/get should fail when escalating period constraint', async () => {
    const period = { from: '2026-01-01', to: '2026-01-31' }
    const delegation = await AccountEgress.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { period },
      proofs: await top(),
    })

    {
      const get = AccountEgress.get.invoke({
        issuer: mallory,
        audience: service,
        with: account.did(),
        nb: { period: { from: '2025-12-31', to: period.to } },
        proofs: [delegation],
      })

      const result = await access(await get.delegate(), {
        capability: AccountEgress.get,
        principal: Verifier,
        authority: service,
        validateAuthorization,
      })

      assert.ok(result.error)
      assert(
        result.error.message.includes(
          `2025-12-31 violates imposed period.from constraint ${period.from}`
        )
      )
    }

    {
      const get = AccountEgress.get.invoke({
        issuer: mallory,
        audience: service,
        with: account.did(),
        nb: { period: { from: period.from, to: '2026-02-01' } },
        proofs: [delegation],
      })

      const result = await access(await get.delegate(), {
        capability: AccountEgress.get,
        principal: Verifier,
        authority: service,
        validateAuthorization,
      })

      assert.ok(result.error)
      assert(
        result.error.message.includes(
          `2026-02-01 violates imposed period.to constraint ${period.to}`
        )
      )
    }
  })

  // Note: Schema.string() doesn't validate ISO 8601 date format at the schema level.
  // Date format validation should be done at runtime by the service handler.

  it('account/egress/get succeeds when spaces are equal in delegation and invocation', async () => {
    const spaces = [space.did()]
    const delegation = await AccountEgress.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces },
      proofs: await top(),
    })

    const get = AccountEgress.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountEgress.get.can)
    assert.deepEqual(result.ok.capability.nb, { spaces })
  })

  it('account/egress/get succeeds when delegation has no spaces constraint but invocation specifies spaces', async () => {
    const delegation = await AccountEgress.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: {},
      proofs: await top(),
    })

    const spaces = [space.did()]
    const get = AccountEgress.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountEgress.get.can)
    assert.deepEqual(result.ok.capability.nb, { spaces })
  })

  it('account/egress/get should fail when delegation has spaces constraint but invocation asks for all spaces', async () => {
    const spaces = [space.did()]
    const delegation = await AccountEgress.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces },
      proofs: await top(),
    })

    const get = AccountEgress.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: {},
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
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

  it('account/egress/get succeeds when invocation asks for subset of delegation spaces', async () => {
    const delegationSpaces = [space.did(), bob.did()]
    const delegation = await AccountEgress.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces: delegationSpaces },
      proofs: await top(),
    })

    const invocationSpaces = [space.did()]
    const get = AccountEgress.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces: invocationSpaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
      principal: Verifier,
      authority: service,
      validateAuthorization,
    })

    assert.ok(result.ok)
    assert.deepEqual(result.ok.audience.did(), service.did())
    assert.equal(result.ok.capability.can, AccountEgress.get.can)
    assert.deepEqual(result.ok.capability.nb, { spaces: invocationSpaces })
  })

  it('account/egress/get should fail when invocation asks for spaces not in delegation constraint', async () => {
    const delegationSpaces = [space.did()]
    const delegation = await AccountEgress.get.delegate({
      issuer: alice,
      audience: mallory,
      with: account.did(),
      nb: { spaces: delegationSpaces },
      proofs: await top(),
    })

    const invocationSpaces = [space.did(), bob.did()]
    const get = AccountEgress.get.invoke({
      issuer: mallory,
      audience: service,
      with: account.did(),
      nb: { spaces: invocationSpaces },
      proofs: [delegation],
    })

    const result = await access(await get.delegate(), {
      capability: AccountEgress.get,
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
