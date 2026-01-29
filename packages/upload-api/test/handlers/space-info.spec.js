import * as Space from '@storacha/capabilities/space'
import assert from 'assert'
import {
  cleanupContext,
  createContext,
} from '../../src/test/helpers/context.js'
import { createSpace } from '../../src/test/helpers/utils.js'
import * as principal from '@ucanto/principal'

describe('space/info', function () {
  /** @type {import('../../src/test/types.js').UcantoServerTestContext} */
  let ctx
  beforeEach(async function () {
    ctx = await createContext()
  })
  this.afterEach(async function () {
    await cleanupContext(ctx)
  })

  it('should fail before registering space', async function () {
    const space = await principal.ed25519.generate()

    const { service, connection } = ctx

    const inv = await Space.info
      .invoke({
        issuer: space,
        audience: service,
        with: space.did(),
      })
      .execute(connection)

    if (inv.out.error) {
      assert.deepEqual(inv.out.error.message, `Space not found.`)
      const expectedErrorName = 'SpaceUnknown'
      assert.deepEqual(
        inv.out.error.name,
        expectedErrorName,
        `error result has name ${expectedErrorName}`
      )
    } else {
      assert.fail()
    }
  })

  it('should return space info', async function () {
    const { signer: issuer, service, connection } = ctx

    const { space, delegation } = await createSpace(
      issuer,
      service,
      connection,
      'space-info@dag.house'
    )

    const inv = await Space.info
      .invoke({
        issuer,
        audience: service,
        with: space.did(),
        proofs: [delegation],
      })
      .execute(connection)

    if (inv.out.error) {
      assert.fail(inv.out.error.message)
    } else {
      assert.equal(inv.out.ok.did, space.did())
      assert.deepEqual(inv.out.ok.providers, [service.did()])
    }
  })
})
