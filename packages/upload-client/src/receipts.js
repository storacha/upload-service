import retry, { AbortError } from 'p-retry'
import { CAR } from '@ucanto/transport'
import { isDelegation, Receipt } from '@ucanto/core'
import { receiptsEndpoint } from './service.js'
import { REQUEST_RETRIES } from './constants.js'

/** @import * as API from '../src/types.js' */

/** @implements {API.ReceiptNotFound} */
export class ReceiptNotFound extends Error {
  name = /** @type {const} */ ('ReceiptNotFound')

  /**
   * @param {API.UnknownLink} taskCid
   */
  constructor(taskCid) {
    super()
    this.taskCid = taskCid
  }

  /* c8 ignore start */
  get reason() {
    return `receipt not found for task ${this.taskCid} in the indexed workflow`
  }
  /* c8 ignore end */
}

/** @implements {API.ReceiptMissing} */
export class ReceiptMissing extends Error {
  name = /** @type {const} */ ('ReceiptMissing')

  /**
   * @param {API.UnknownLink} taskCid
   */
  constructor(taskCid) {
    super()
    this.taskCid = taskCid
  }

  /* c8 ignore start */
  get reason() {
    return `receipt missing for task ${this.taskCid}`
  }
  /* c8 ignore end */
}

/**
 * Polls for a receipt for an executed task by its CID.
 *
 * @template {API.Capability} C
 * @template {Record<string, any>} S
 * @param {API.UCANLink<[C]>} taskCid
 * @param {API.ReceiptGetOptions<S> & API.Retryable} [options]
 * @returns {Promise<API.InferReceipt<C, S>>}
 */
export async function poll(taskCid, options) {
  return await retry(
    async () => {
      const res = await get(taskCid, options)
      if (res.error) {
        // @ts-ignore
        if (res.error.name === 'ReceiptNotFound') {
          // throw an error that will cause `p-retry` to retry with
          throw res.error
        } else {
          throw new AbortError(
            new Error(`failed to fetch receipt for task: ${taskCid}`, {
              cause: res.error,
            })
          )
        }
      }
      return res.ok
    },
    {
      signal: options?.signal,
      onFailedAttempt: console.warn,
      /* c8 ignore next */
      retries: options?.retries ?? REQUEST_RETRIES,
    }
  )
}

/**
 * Calculate a receipt endpoint from the URL of a channel, if it has one.
 *
 * @param {API.Channel<Record<string, any>>} channel
 */
function receiptEndpointFromChannel(channel) {
  if ('url' in channel && channel.url instanceof URL) {
    const url = channel.url
    return new URL('/receipt/', url.toString())
  } else {
    return null
  }
}

/**
 * Get a receipt for an executed task by its CID.
 *
 * @template {API.Capability} C
 * @template {Record<string, any>} S
 * @param {API.UCANLink<[C]>} taskCid
 * @param {API.ReceiptGetOptions<S>} [options]
 * @returns {Promise<API.Result<API.InferReceipt<C, S>, API.ReceiptNotFound|API.ReceiptMissing>>}
 */
export async function get(taskCid, options) {
  const channel = options?.connection?.channel
  const endpoint =
    options?.endpoint ??
    (channel && receiptEndpointFromChannel(channel)) ??
    receiptsEndpoint

  // Fetch receipt from endpoint
  const url = new URL(taskCid.toString(), endpoint)
  const fetchReceipt = options?.fetch ?? globalThis.fetch.bind(globalThis)
  const workflowResponse = await fetchReceipt(url, { signal: options?.signal })
  /* c8 ignore start */
  if (workflowResponse.status === 404) {
    return {
      error: new ReceiptNotFound(taskCid),
    }
  }
  /* c8 ignore stop */
  // Get receipt from Message Archive
  const agentMessageBytes = new Uint8Array(await workflowResponse.arrayBuffer())
  // Decode message
  const agentMessage = await CAR.request.decode({
    body: agentMessageBytes,
    headers: {},
  })
  // Get receipt from the potential multiple receipts in the message

  const receipt =
    /** @type {API.InferReceipt<C, S>|undefined} */
    (agentMessage.receipts.get(`${taskCid}`))
  if (!receipt) {
    // This could be an agent message containing an invocation for ucan/conclude
    // that includes the receipt as an attached block, or it may contain a
    // receipt for ucan/conclude that includes the receipt as an attached block.
    const blocks = new Map()
    for (const b of agentMessage.iterateIPLDBlocks()) {
      blocks.set(b.cid.toString(), b)
    }
    const invocations = [...agentMessage.invocations]
    for (const receipt of agentMessage.receipts.values()) {
      if (isDelegation(receipt.ran)) {
        invocations.push(receipt.ran)
      }
    }
    for (const inv of invocations) {
      /* c8 ignore next */
      if (inv.capabilities[0]?.can !== 'ucan/conclude') continue
      const root = Object(inv.capabilities[0].nb).receipt
      const receipt = root
        ? /** @type {API.InferReceipt<C, S>|null} */ (
            Receipt.view({ root, blocks }, null)
          )
        /* c8 ignore next */
        : null
      /* c8 ignore next */
      if (!receipt) continue
      /* c8 ignore next */
      const ran = isDelegation(receipt.ran) ? receipt.ran.cid : receipt.ran
      if (ran.toString() === taskCid.toString()) {
        return { ok: receipt }
      }
    }
    return {
      error: new ReceiptMissing(taskCid),
    }
  }
  return {
    ok: receipt,
  }
}
