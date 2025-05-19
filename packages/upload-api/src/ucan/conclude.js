import * as API from '../types.js'
import { provide } from '@ucanto/server'
import { Receipt, Invocation } from '@ucanto/core'
import { conclude } from '@storacha/capabilities/ucan'
import * as BlobAccept from '../blob/accept.js'
import * as BlobReplicaTransfer from '../blob/replica/transfer.js'

/**
 * @param {API.ConcludeServiceContext & API.LegacyConcludeServiceContext} context
 * @returns {API.ServiceMethod<API.UCANConclude, API.UCANConcludeSuccess, API.UCANConcludeFailure>}
 */
export const ucanConcludeProvider = (context) =>
  provide(conclude, async ({ invocation, context: invContext }) => {
    // 🚧 THIS IS A TEMPORARY HACK 🚧
    // When we receive a receipt for the invocation we want to resume the tasks
    // that were awaiting in the background. In the future task scheduler is
    // expected to handle coordination of tasks and their dependencies. In the
    // meantime we poll tasks that are awaiting a receipt.
    const receipt = getConcludeReceipt(invocation)
    const taskRes = Invocation.isInvocation(receipt.ran)
      ? { ok: receipt.ran }
      : await context.agentStore.invocations.get(receipt.ran)

    // If can not find task for this receipt there is nothing to do here, if it
    // was receipt for something we care about we would have invocation record.
    if (!taskRes.ok) {
      return { ok: { time: Date.now() } }
    }

    const pollContext = { ...context, invocation: invContext }
    const results = await Promise.all([
      BlobAccept.poll(pollContext, receipt, taskRes.ok),
      BlobReplicaTransfer.poll(pollContext, receipt, taskRes.ok),
    ])

    // If polling failed we propagate the error to the caller, while this is
    // not ideal it's a better option than silently failing. We do not expect
    // this to happen, however, if it does this will propagate to the user and
    // they will be able to complain about it.
    for (const result of results) {
      if (result.error) {
        return result
      }
    }

    return { ok: { time: Date.now() } }
  })

/**
 * @param {import('@ucanto/interface').Invocation} concludeFx
 */
export function getConcludeReceipt(concludeFx) {
  const receiptBlocks = new Map()
  for (const block of concludeFx.iterateIPLDBlocks()) {
    receiptBlocks.set(`${block.cid}`, block)
  }
  return Receipt.view({
    // @ts-expect-error object of type unknown
    root: concludeFx.capabilities[0].nb.receipt,
    blocks: receiptBlocks,
  })
}

// * @template {API.Signer} Signer
// * @template {API.Principal} Principal
// * @template {API.Receipt} Receipt
// * @param {Signer} id
// * @param {Principal} serviceDid
// * @param {Receipt} receipt

/**
 * @param {API.Signer} id
 * @param {API.Principal} serviceDid
 * @param {API.Receipt} receipt
 */
export function createConcludeInvocation(id, serviceDid, receipt) {
  const receiptBlocks = []
  const receiptCids = []
  for (const block of receipt.iterateIPLDBlocks()) {
    receiptBlocks.push(block)
    receiptCids.push(block.cid)
  }
  const concludeAllocatefx = conclude.invoke({
    issuer: id,
    audience: serviceDid,
    with: id.toDIDKey(),
    nb: {
      receipt: receipt.link(),
    },
    expiration: Infinity,
    facts: [
      {
        ...receiptCids,
      },
    ],
  })
  for (const block of receiptBlocks) {
    concludeAllocatefx.attach(block)
  }

  return concludeAllocatefx
}
