import { ed25519 } from '@ucanto/principal'
import * as UCAN from '@storacha/capabilities/ucan'
import { Delegation, Receipt } from '@ucanto/core'
import * as BlobCapabilities from '@storacha/capabilities/blob'
import * as W3sBlobCapabilities from '@storacha/capabilities/web3.storage/blob'
import * as SpaceBlobCapabilities from '@storacha/capabilities/space/blob'
import * as HTTPCapabilities from '@storacha/capabilities/http'
import { SpaceDID } from '@storacha/capabilities/utils'
import retry, { AbortError } from 'p-retry'
import { servicePrincipal, connection } from '../service.js'
import { REQUEST_RETRIES } from '../constants.js'
import { poll } from '../receipts.js'
import { isCloudflareWorkers } from '../runtime.js'

/** @import * as API from '../types.js' */

/**
 * @param {string} url
 * @param {API.ProgressFn} handler
 */
function createUploadProgressHandler(url, handler) {
  /** @param {API.ProgressStatus} status */
  const onUploadProgress = ({ total, loaded, lengthComputable }) => {
    return handler({ total, loaded, lengthComputable, url })
  }
  return onUploadProgress
}

// FIXME this code has been copied over from upload-api
/**
 * @param {API.Invocation} concludeFx
 */
function getConcludeReceipt(concludeFx) {
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

// FIXME this code has been copied over from upload-api
/**
 * @param {API.Receipt} receipt
 */
function parseBlobAddReceiptNext(receipt) {
  // Get invocations next
  /**
   * @type {API.Invocation[]}
   */
  // @ts-expect-error read only effect
  const forkInvocations = receipt.fx.fork
  const allocateTask =
    forkInvocations.find(
      (fork) => fork.capabilities[0].can === BlobCapabilities.allocate.can
      /* c8 ignore next 4 */ // tested by legacy integration test in w3up-client
    ) ??
    forkInvocations.find(
      (fork) => fork.capabilities[0].can === W3sBlobCapabilities.allocate.can
    )
  const concludefxs = forkInvocations.filter(
    (fork) => fork.capabilities[0].can === UCAN.conclude.can
  )
  const putTask = forkInvocations.find(
    (fork) => fork.capabilities[0].can === HTTPCapabilities.put.can
  )

  const acceptTask =
    /** @type {API.Invocation<API.BlobAccept>|undefined} */
    (
      forkInvocations.find(
        (fork) => fork.capabilities[0].can === BlobCapabilities.accept.can
        /* c8 ignore next 4 */ // tested by legacy integration test in w3up-client
      ) ??
        forkInvocations.find(
          (fork) => fork.capabilities[0].can === W3sBlobCapabilities.accept.can
        )
    )

  /* c8 ignore next 3 */
  if (!allocateTask || !concludefxs.length || !putTask || !acceptTask) {
    throw new Error('mandatory effects not received')
  }

  // Decode receipts available
  const nextReceipts = concludefxs.map((fx) => getConcludeReceipt(fx))
  /** @type {API.Receipt<API.BlobAllocateSuccess, API.BlobAllocateFailure> | undefined} */
  // @ts-expect-error types unknown for next
  const allocateReceipt = nextReceipts.find((receipt) =>
    receipt.ran.link().equals(allocateTask.cid)
  )
  /** @type {API.Receipt<{}, API.Failure> | undefined} */
  // @ts-expect-error types unknown for next
  const putReceipt = nextReceipts.find((receipt) =>
    receipt.ran.link().equals(putTask.cid)
  )

  /** @type {API.Receipt<API.BlobAcceptSuccess, API.BlobAcceptFailure> | undefined} */
  // @ts-expect-error types unknown for next
  const acceptReceipt = nextReceipts.find((receipt) =>
    receipt.ran.link().equals(acceptTask.cid)
  )

  /* c8 ignore next 3 */
  if (!allocateReceipt) {
    throw new Error('mandatory effects not received')
  }

  return {
    allocate: {
      task: allocateTask,
      receipt: allocateReceipt,
    },
    put: {
      task: putTask,
      receipt: putReceipt,
    },
    accept: {
      task: acceptTask,
      receipt: acceptReceipt,
    },
  }
}

// FIXME this code has been copied over from upload-api
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
  const concludeAllocatefx = UCAN.conclude.invoke({
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

/**
 * Store a blob to the service. The issuer needs the `blob/add`
 * delegated capability.
 *
 * Required delegated capability proofs: `blob/add`
 *
 * @param {API.InvocationConfig} conf Configuration
 * for the UCAN invocation. An object with `issuer`, `with` and `proofs`.
 *
 * The `issuer` is the signing authority that is issuing the UCAN
 * invocation(s). It is typically the user _agent_.
 *
 * The `with` is the resource the invocation applies to. It is typically the
 * DID of a space.
 *
 * The `proofs` are a set of capability delegations that prove the issuer
 * has the capability to perform the action.
 *
 * The issuer needs the `blob/add` delegated capability.
 * @param {import('multiformats').MultihashDigest} digest
 * @param {Blob|Uint8Array} data Blob data.
 * @param {API.RequestOptions} [options]
 * @returns {Promise<API.BlobAddOk>}
 */
export async function add(
  { issuer, with: resource, proofs, audience },
  digest,
  data,
  options = {}
) {
  /* c8 ignore next 2 */
  const bytes =
    data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer())
  const size = bytes.length
  /* c8 ignore next */
  const conn = options.connection ?? connection

  const result = await retry(
    async () => {
      return await SpaceBlobCapabilities.add
        .invoke({
          issuer,
          /* c8 ignore next */
          audience: audience ?? servicePrincipal,
          with: SpaceDID.from(resource),
          nb: input(digest, size),
          proofs,
          nonce: options.nonce,
        })
        .execute(conn)
    },
    {
      onFailedAttempt: console.warn,
      retries: options.retries ?? REQUEST_RETRIES,
    }
  )

  if (!result.out.ok) {
    throw new Error(`failed ${SpaceBlobCapabilities.add.can} invocation`, {
      cause: result.out.error,
    })
  }

  const nextTasks = parseBlobAddReceiptNext(result)

  const { receipt: allocateReceipt } = nextTasks.allocate
  /* c8 ignore next 5 */
  if (!allocateReceipt.out.ok) {
    throw new Error(`failed ${SpaceBlobCapabilities.add.can} invocation`, {
      cause: allocateReceipt.out.error,
    })
  }

  const { address } = allocateReceipt.out.ok
  if (address) {
    const fetchWithUploadProgress =
      options.fetchWithUploadProgress ||
      options.fetch ||
      globalThis.fetch.bind(globalThis)

    let fetchDidCallUploadProgressCb = false
    await retry(
      async () => {
        try {
          const res = await fetchWithUploadProgress(address.url, {
            method: 'PUT',
            ...(!isCloudflareWorkers && { mode: 'cors' }),
            body: bytes,
            headers: address.headers,
            signal: options.signal,
            onUploadProgress: (status) => {
              fetchDidCallUploadProgressCb = true
              if (options.onUploadProgress)
                createUploadProgressHandler(
                  address.url,
                  options.onUploadProgress
                )(status)
            },
            // @ts-expect-error - this is needed by recent versions of node - see https://github.com/bluesky-social/atproto/pull/470 for more info
            duplex: 'half',
          })
          // do not retry client errors
          if (res.status >= 400 && res.status < 500) {
            throw new AbortError(`upload failed: ${res.status}`)
          }
          if (!res.ok) {
            throw new Error(`upload failed: ${res.status}`)
          }
          await res.arrayBuffer()
        } catch (err) {
          if (options.signal?.aborted === true) {
            throw new AbortError('upload aborted')
          }
          throw err
        }
      },
      {
        retries: options.retries ?? REQUEST_RETRIES,
      }
    )

    if (!fetchDidCallUploadProgressCb && options.onUploadProgress) {
      // the fetch implementation didn't support onUploadProgress
      const blob = new Blob([bytes])
      options.onUploadProgress({
        total: blob.size,
        loaded: blob.size,
        lengthComputable: false,
      })
    }
  }

  // Invoke `conclude` with `http/put` receipt
  let { receipt: httpPutReceipt } = nextTasks.put
  if (!httpPutReceipt?.out.ok) {
    const derivedSigner = ed25519.from(
      /** @type {API.SignerArchive<API.DID, typeof ed25519.signatureCode>} */
      (nextTasks.put.task.facts[0]['keys'])
    )
    httpPutReceipt = await Receipt.issue({
      issuer: derivedSigner,
      ran: nextTasks.put.task.cid,
      result: { ok: {} },
    })
    const httpPutConcludeInvocation = createConcludeInvocation(
      issuer,
      /* c8 ignore next */
      audience ?? servicePrincipal,
      httpPutReceipt
    )
    const ucanConclude = await httpPutConcludeInvocation.execute(conn)
    if (!ucanConclude.out.ok) {
      throw new Error(
        `failed ${UCAN.conclude.can} for ${HTTPCapabilities.put.can} invocation`,
        {
          cause: ucanConclude.out.error,
        }
      )
    }
  }

  // Ensure the blob has been accepted
  let { receipt: acceptReceipt } = nextTasks.accept
  if (!acceptReceipt || !acceptReceipt.out.ok) {
    acceptReceipt = await poll(nextTasks.accept.task.link(), {
      ...options,
      /* c8 ignore next 3 */
      endpoint: options.receiptsEndpoint
        ? new URL(options.receiptsEndpoint)
        : undefined,
      // The connection we have is for the upload service, which does not
      // actually implement blob/accept. However, it does provide receipts for
      // blob accept invocations it has made to storage nodes. Hence we type
      // assert that this connection is a connecton to a service that
      // implements blob/accept so that we can get a typed receipt back.
      connection: /** @type {API.Connection<API.BlobService>} */ (Object(conn)),
    })
    /* c8 ignore next 5 */
    if (acceptReceipt.out.error) {
      throw new Error(`${BlobCapabilities.accept.can} failure`, {
        cause: acceptReceipt.out.error,
      })
    }
  }

  const blocks = new Map(
    [...acceptReceipt.iterateIPLDBlocks()].map((block) => [
      `${block.cid}`,
      block,
    ])
  )
  const site = Delegation.view({
    root: /** @type {API.UCANLink<[import('@web3-storage/content-claims/capability/api').AssertLocation]>} */ (
      acceptReceipt.out.ok?.site
    ),
    blocks,
  })

  return { site }
}

/** Returns the ability used by an invocation. */
export const ability = SpaceBlobCapabilities.add.can

/**
 * Returns required input to the invocation.
 *
 * @param {import('multiformats').MultihashDigest} digest
 * @param {number} size
 */
export const input = (digest, size) => ({
  blob: {
    digest: digest.bytes,
    size,
  },
})
