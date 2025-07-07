import assert from 'assert'
import { put } from '@storacha/capabilities/http'
import { conclude } from '@storacha/capabilities/ucan'
import { issue } from '@ucanto/core/receipt'
import { Message } from '@ucanto/core'
import * as CAR from '@ucanto/transport/car'
import * as Fixtures from './fixtures.js'
import { randomBlock } from './helpers/random.js'
import * as Receipt from '../src/receipts.js'

describe('Receipt.get', () => {
  it('should extract receipt from ucan/conclude invocation', async () => {
    const alice = Fixtures.alice
    const service = Fixtures.serviceSigner

    const size = 32
    const digest = (await randomBlock(size)).cid.multihash

    const putTask = await put
      .invoke({
        issuer: service,
        audience: alice,
        with: service.did(),
        nb: {
          body: { digest: digest.bytes, size },
          url: 'http://localhost',
          headers: {},
        },
      })
      .delegate()

    const receipt = await issue({
      issuer: alice,
      ran: putTask,
      result: { ok: {} },
    })

    const receiptBlocks = []
    for (const b of receipt.iterateIPLDBlocks()) {
      receiptBlocks.push(b)
    }

    const concludeTask = conclude.invoke({
      issuer: alice,
      audience: service,
      with: alice.did(),
      nb: {
        receipt: receipt.root.cid,
      },
      facts: [{ ...receiptBlocks.map((b) => b.cid) }],
    })

    for (const b of receiptBlocks) {
      concludeTask.attach(b)
    }

    const message = await Message.build({ invocations: [concludeTask] })

    const res = await Receipt.get(putTask.cid, {
      async fetch() {
        const req = await CAR.outbound.encode(message)
        return new Response(req.body, { headers: req.headers })
      },
    })

    assert.equal(res.error, undefined)
    assert(res.ok)
  })

  it('should extract receipt from ucan/conclude receipt', async () => {
    const alice = Fixtures.alice
    const service = Fixtures.serviceSigner

    const size = 32
    const digest = (await randomBlock(size)).cid.multihash

    const putTask = await put
      .invoke({
        issuer: service,
        audience: alice,
        with: service.did(),
        nb: {
          body: { digest: digest.bytes, size },
          url: 'http://localhost',
          headers: {},
        },
      })
      .delegate()

    const putReceipt = await issue({
      issuer: alice,
      ran: putTask,
      result: { ok: {} },
    })

    const receiptBlocks = []
    for (const b of putReceipt.iterateIPLDBlocks()) {
      receiptBlocks.push(b)
    }

    const concludeTask = await conclude
      .invoke({
        issuer: alice,
        audience: service,
        with: alice.did(),
        nb: {
          receipt: putReceipt.root.cid,
        },
        facts: [{ ...receiptBlocks.map((b) => b.cid) }],
      })
      .delegate()

    for (const b of receiptBlocks) {
      concludeTask.attach(b)
    }

    const concludeReceipt = await issue({
      issuer: service,
      ran: concludeTask,
      result: { ok: {} },
    })

    const message = await Message.build({ receipts: [concludeReceipt] })

    const res = await Receipt.get(putTask.cid, {
      async fetch() {
        const req = await CAR.outbound.encode(message)
        return new Response(req.body, { headers: req.headers })
      },
    })

    assert.equal(res.error, undefined)
    assert(res.ok)
  })
})
