import { Subscription } from '@storacha/capabilities'
import * as API from '../../types.js'
import { createServer, connect } from '../../lib.js'
import { alice, registerSpace } from '../util.js'
import { createAuthorization } from '../helpers/utils.js'

/** @type {API.Tests} */
export const test = {
  'subscription/list retrieves subscriptions for account': async (
    assert,
    context
  ) => {
    const spaces = await Promise.all([
      registerSpace(alice, context, 'alic_e'),
      registerSpace(alice, context, 'alic_e'),
    ])
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const subListRes = await Subscription.list
      .invoke({
        issuer: alice,
        audience: context.id,
        with: spaces[0].account.did(),
        nb: undefined,
        proofs: await createAuthorization({
          agent: alice,
          account: spaces[0].account,
          service: context.service,
        }),
      })
      .execute(connection)

    assert.ok(subListRes.out.ok)

    const results = subListRes.out.ok?.results
    const totalConsumers = results?.reduce(
      (total, s) => total + s.consumers.length,
      0
    )
    assert.equal(totalConsumers, spaces.length)

    for (const space of spaces) {
      assert.ok(results?.some((s) => s.consumers[0] === space.spaceDid))
    }
  },
}
