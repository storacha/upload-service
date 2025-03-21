import * as CAR from '@ucanto/transport/car'
import { Usage } from '@storacha/capabilities'
import * as API from '../../types.js'
import { createServer, connect } from '../../lib.js'
import { alice, registerSpace } from '../util.js'
import { uploadBlob } from '../helpers/blob.js'

/** @type {API.Tests} */
export const test = {
  'usage/report retrieves usage data': async (assert, context) => {
    const { proof, spaceDid } = await registerSpace(alice, context)
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

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

    const usageReportRes = await Usage.report
      .invoke({
        issuer: alice,
        audience: context.id,
        with: spaceDid,
        nb: { period: { from: 0, to: Math.ceil(Date.now() / 1000) + 1 } },
        proofs: [proof],
      })
      .execute(connection)

    const provider =
      /** @type {import('../types.js').ProviderDID} */
      (context.id.did())
    const report = usageReportRes.out.ok?.[provider]
    assert.equal(report?.space, spaceDid)
    assert.equal(report?.size.initial, 0)
    assert.equal(report?.size.final, size)
    assert.equal(report?.events.length, 1)
    assert.equal(report?.events[0].delta, size)
  },
}
