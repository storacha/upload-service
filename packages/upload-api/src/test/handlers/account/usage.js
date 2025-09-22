import * as CAR from '@ucanto/transport/car'
import { AccountUsage, Provider } from '@storacha/capabilities'
import * as API from '../../../types.js'
import { createServer, connect } from '../../../lib.js'
import { alice, createSpace } from '../../util.js'
import { uploadBlob } from '../../helpers/blob.js'
import { createAuthorization } from '../../helpers/utils.js'
import { Absentee } from '@ucanto/principal'

/** @type {API.Tests} */
export const test = {
  'account/usage/get retrieves account usage data': async (assert, context) => {
    const account = 'did:mailto:example.com:alice'
    const authorizations = await createAuthorization({
      agent: alice,
      account: Absentee.from({ id: account }),
      service: context.service,
    })

    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const { proof, space, spaceDid } = await createSpace(alice)

    await Provider.add
      .invoke({
        issuer: alice,
        audience: context.service,
        with: account,
        nb: {
          provider: context.service.did(),
          consumer: space.did(),
        },
        proofs: authorizations,
      })
      .execute(connection)

    const data = new Uint8Array([11, 22, 34, 44, 55])
    const link = await CAR.codec.link(data)
    const size = data.byteLength

    await uploadBlob(
      {
        connection,
        issuer: alice,
        audience: context.id,
        with: spaceDid,
        proofs: [proof],
      },
      {
        digest: link.multihash,
        bytes: data,
      }
    )

    const accountUsageRes = await AccountUsage.get
      .invoke({
        issuer: alice,
        audience: context.id,
        with: account,
        nb: { period: { from: 0, to: Math.ceil(Date.now() / 1000) + 1 } },
        proofs: authorizations,
      })
      .execute(connection)

    assert.ok(accountUsageRes.out.ok)
    const usage = accountUsageRes.out.ok
    assert.ok(usage)
    assert.equal(usage?.total, size)
    const spaceUsage = usage?.spaces[space.did()]
    assert.ok(spaceUsage)
    assert.equal(spaceUsage?.total, size)
    const report = spaceUsage?.providers[context.service.did()]
    assert.equal(report?.space, spaceDid)
    assert.equal(report?.size.initial, 0)
    assert.equal(report?.size.final, size)
    assert.equal(report?.events.length, 1)
    assert.equal(report?.events[0].delta, size)
  },

  'account/usage/get with multiple spaces': async (assert, context) => {
    const account = 'did:mailto:example.com:alice'
    const authorizations = await createAuthorization({
      agent: alice,
      account: Absentee.from({ id: account }),
      service: context.service,
    })

    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    // Create two spaces
    const {
      proof: proof1,
      space: space1,
      spaceDid: spaceDid1,
    } = await createSpace(alice)
    const {
      proof: proof2,
      space: space2,
      spaceDid: spaceDid2,
    } = await createSpace(alice)

    // Add provider for both spaces
    await Provider.add
      .invoke({
        issuer: alice,
        audience: context.service,
        with: account,
        nb: {
          provider: context.service.did(),
          consumer: space1.did(),
        },
        proofs: authorizations,
      })
      .execute(connection)

    await Provider.add
      .invoke({
        issuer: alice,
        audience: context.service,
        with: account,
        nb: {
          provider: context.service.did(),
          consumer: space2.did(),
        },
        proofs: authorizations,
      })
      .execute(connection)

    // Upload to both spaces
    const data1 = new Uint8Array([11, 22, 34])
    const data2 = new Uint8Array([44, 55, 66, 77])
    const size1 = data1.byteLength
    const size2 = data2.byteLength

    await uploadBlob(
      {
        connection,
        issuer: alice,
        audience: context.id,
        with: spaceDid1,
        proofs: [proof1],
      },
      {
        digest: (await CAR.codec.link(data1)).multihash,
        bytes: data1,
      }
    )

    await uploadBlob(
      {
        connection,
        issuer: alice,
        audience: context.id,
        with: spaceDid2,
        proofs: [proof2],
      },
      {
        digest: (await CAR.codec.link(data2)).multihash,
        bytes: data2,
      }
    )

    const accountUsageRes = await AccountUsage.get
      .invoke({
        issuer: alice,
        audience: context.id,
        with: account,
        nb: { period: { from: 0, to: Math.ceil(Date.now() / 1000) + 1 } },
        proofs: authorizations,
      })
      .execute(connection)

    assert.ok(accountUsageRes.out.ok)
    const usage = accountUsageRes.out.ok
    console.log(usage)
    assert.equal(usage?.total, size1 + size2)

    // Check space 1 usage
    const space1Usage = usage?.spaces[space1.did()]
    assert.ok(space1Usage)
    assert.equal(space1Usage?.total, size1)

    // Check space 2 usage
    const space2Usage = usage?.spaces[space2.did()]
    assert.ok(space2Usage)
    assert.equal(space2Usage?.total, size2)
  },

  'account/usage/get with spaces filter': async (assert, context) => {
    const account = 'did:mailto:example.com:alice'
    const authorizations = await createAuthorization({
      agent: alice,
      account: Absentee.from({ id: account }),
      service: context.service,
    })

    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    // Create two spaces
    const {
      proof: proof1,
      space: space1,
      spaceDid: spaceDid1,
    } = await createSpace(alice)
    const {
      proof: proof2,
      space: space2,
      spaceDid: spaceDid2,
    } = await createSpace(alice)

    // Add provider for both spaces
    await Provider.add
      .invoke({
        issuer: alice,
        audience: context.service,
        with: account,
        nb: {
          provider: context.service.did(),
          consumer: space1.did(),
        },
        proofs: authorizations,
      })
      .execute(connection)

    await Provider.add
      .invoke({
        issuer: alice,
        audience: context.service,
        with: account,
        nb: {
          provider: context.service.did(),
          consumer: space2.did(),
        },
        proofs: authorizations,
      })
      .execute(connection)

    // Upload to both spaces
    const data1 = new Uint8Array([11, 22, 34])
    const data2 = new Uint8Array([44, 55, 66, 77])
    const size1 = data1.byteLength

    await uploadBlob(
      {
        connection,
        issuer: alice,
        audience: context.id,
        with: spaceDid1,
        proofs: [proof1],
      },
      {
        digest: (await CAR.codec.link(data1)).multihash,
        bytes: data1,
      }
    )

    await uploadBlob(
      {
        connection,
        issuer: alice,
        audience: context.id,
        with: spaceDid2,
        proofs: [proof2],
      },
      {
        digest: (await CAR.codec.link(data2)).multihash,
        bytes: data2,
      }
    )

    // Request usage for only space1
    const accountUsageRes = await AccountUsage.get
      .invoke({
        issuer: alice,
        audience: context.id,
        with: account,
        nb: {
          spaces: [space1.did()],
          period: { from: 0, to: Math.ceil(Date.now() / 1000) + 1 },
        },
        proofs: authorizations,
      })
      .execute(connection)

    assert.ok(accountUsageRes.out.ok)
    const usage = accountUsageRes.out.ok
    assert.equal(usage?.total, size1) // Only space1's usage

    // Should only contain space1
    const space1Usage = usage?.spaces[space1.did()]
    assert.ok(space1Usage)
    assert.equal(space1Usage?.total, size1)

    // Should not contain space2
    const space2Usage = usage?.spaces[space2.did()]
    assert.equal(space2Usage, undefined)
  },

  'account/usage/get should error when space has no provider': async (
    assert,
    context
  ) => {
    const account = 'did:mailto:example.com:alice'
    const authorizations = await createAuthorization({
      agent: alice,
      account: Absentee.from({ id: account }),
      service: context.service,
    })

    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    // Create two spaces
    const { space: space1 } = await createSpace(alice)
    const { space: space2 } = await createSpace(alice)

    // Add provider for only space1
    await Provider.add
      .invoke({
        issuer: alice,
        audience: context.service,
        with: account,
        nb: {
          provider: context.service.did(),
          consumer: space1.did(),
        },
        proofs: authorizations,
      })
      .execute(connection)

    // Try to get usage - should error because space2 has no provider attached to account
    const accountUsageRes = await AccountUsage.get
      .invoke({
        issuer: alice,
        audience: context.id,
        with: account,
        nb: {
          spaces: [space1.did(), space2.did()],
          period: { from: 0, to: Math.ceil(Date.now() / 1000) + 1 },
        },
        proofs: authorizations,
      })
      .execute(connection)

    assert.ok(accountUsageRes.out.error)
    // The error should indicate that some spaces don't have providers attached to the account
  },
}
