import retry, { AbortError } from 'p-retry'
import { CAR } from '@ucanto/transport'
import { isDelegation, Receipt } from '@ucanto/core'
import { receiptsEndpoint as defaultReceiptsEndpoint } from './service.js'
import { REQUEST_RETRIES } from './constants.js'

export class ReceiptNotFound extends Error {
  /**
   * @param {import('multiformats').UnknownLink} taskCid
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

  get name() {
    return 'ReceiptNotFound'
  }
}

export class ReceiptMissing extends Error {
  /**
   * @param {import('multiformats').UnknownLink} taskCid
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

  get name() {
    return 'ReceiptMissing'
  }
}

/**
 * Polls for a receipt for an executed task by its CID.
 *
 * @param {import('multiformats').UnknownLink} taskCid
 * @param {import('./types.js').RequestOptions} [options]
 * @returns {Promise<import('@ucanto/interface').Receipt>}
 */
export async function poll(taskCid, options = {}) {
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
      onFailedAttempt: console.warn,
      /* c8 ignore next */
      retries: options.retries ?? REQUEST_RETRIES,
    }
  )
}

/**
 * Calculate a receipt endpoint from the URL of a channel, if it has one.
 *
 * @param {import('@ucanto/interface').Channel<Record<string, any>>} channel
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
 * @param {import('multiformats').UnknownLink} taskCid
 * @param {import('./types.js').RequestOptions} [options]
 * @returns {Promise<import('@ucanto/client').Result<import('@ucanto/interface').Receipt, Error>>}
 */
async function get(taskCid, options = {}) {
  const channel = options.connection?.channel
  const receiptsEndpoint =
    options.receiptsEndpoint ??
    (channel && receiptEndpointFromChannel(channel)) ??
    defaultReceiptsEndpoint

  // Fetch receipt from endpoint
  const url = new URL(taskCid.toString(), receiptsEndpoint)
  const fetchReceipt = options.fetch ?? globalThis.fetch.bind(globalThis)
  const workflowResponse = await fetchReceipt(url)
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
  const receipt = agentMessage.receipts.get(`${taskCid}`)
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
      if (inv.capabilities[0]?.can !== 'ucan/conclude') continue
      const root = Object(inv.capabilities[0].nb).receipt
      const receipt = root ? Receipt.view({ root, blocks }, null) : null
      if (!receipt) continue
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
