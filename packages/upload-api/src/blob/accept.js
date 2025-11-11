import * as Blob from '@storacha/capabilities/blob'
import * as W3sBlob from '@storacha/capabilities/web3.storage/blob'
import { Message, Receipt } from '@ucanto/core'
import * as Transport from '@ucanto/transport/car'
import * as API from '../types.js'
import * as DID from '@ipld/dag-ucan/did'
import * as Digest from 'multiformats/hashes/digest'
import { AgentMessage } from '../lib.js'
import { execW3sAccept } from '../web3.storage/blob/accept.js'
import { isW3sBlobAllocateTask } from '../web3.storage/blob/lib.js'
import { isHttpPutTask } from './lib.js'

/**
 * Polls `blob/accept` task whenever we receive a receipt. It may error if passed
 * receipt is for `http/put` task that refers to the `blob/allocate` that we
 * are unable to find.
 *
 * @param {API.ConcludeServiceContext & API.LegacyConcludeServiceContext} context
 * @param {API.Receipt} receipt
 * @param {API.Invocation} putTask The task referred to by `receipt.ran`.
 * @returns {Promise<API.Result<API.Unit, API.Failure>>}
 */
export const poll = async (context, receipt, putTask) => {
  // If it's not an http/put invocation nothing to do here.
  if (!isHttpPutTask(putTask)) {
    return { ok: {} }
  }

  const put = putTask.capabilities[0]
  // Otherwise we are going to lookup allocation corresponding to this http/put
  // in order to issue blob/accept.
  const [, allocation] = /** @type {API.UCANAwait} */ (put.nb.url)['ucan/await']
  const result = await context.agentStore.invocations.get(allocation)
  // If could not find blob/allocate invocation there is something wrong in
  // the system and we return error so it could be propagated to the user. It is
  // not a proper solution as user can not really do anything, but still seems
  // better than silently ignoring, this way user has a chance to report a
  // problem. Client test could potentially also catch errors.
  if (result.error) {
    return result
  }

  // if legacy allocation, use legacy accept
  if (isW3sBlobAllocateTask(result.ok)) {
    // We do not care about the result we just want receipt to be issued and
    // stored.
    await execW3sAccept({ context, putTask, allocateTask: result.ok })
    return { ok: {} }
  }

  const provider = result.ok.audience
  const [allocate] = /** @type {[API.BlobAllocate]} */ (result.ok.capabilities)

  const configure = await context.router.configureInvocation(
    provider,
    Blob.accept.create({
      with: provider.did(),
      nb: {
        blob: allocate.nb.blob,
        space: allocate.nb.space,
        _put: {
          'ucan/await': ['.out.ok', receipt.ran.link()],
        },
      },
    }),
    {
      // ⚠️ We need invocation to be deterministic which is why we use exact
      // same as it is on allocation which will guarantee that expiry is the
      // same regardless when we received `http/put` receipt.
      //
      // ℹ️ This works around the fact that we index receipts by invocation link
      // as opposed to task link which would not care about the expiration.
      expiration: result.ok.expiration,
    }
  )
  if (configure.error) {
    return configure
  }

  const acceptReceipt = await configure.ok.invocation.execute(
    configure.ok.connection
  )

  // Create receipt for legacy `web3.storage/blob/accept`. The old client
  // `@web3-storage/w3up-client` will poll for a receipt for this task, so
  // we create one whose result is simply the result of the actual `blob/accept`
  // task.
  //
  // TODO: remove when all users migrate to `@storacha/client`.
  const w3sAccept = W3sBlob.accept.invoke({
    issuer: context.id,
    audience: context.id,
    with: context.id.did(),
    nb: {
      blob: allocate.nb.blob,
      space: /** @type {API.DIDKey} */ (DID.decode(allocate.nb.space).did()),
      _put: { 'ucan/await': ['.out.ok', receipt.ran.link()] },
    },
    expiration: Infinity,
  })
  const w3sAcceptTask = await w3sAccept.delegate()
  const w3sAcceptReceipt = await Receipt.issue({
    issuer: context.id,
    ran: w3sAcceptTask.cid,
    result: acceptReceipt.out,
    fx: acceptReceipt.fx,
  })

  // record the invocation and the receipt
  const message = await Message.build({
    invocations: [configure.ok.invocation, w3sAcceptTask],
    receipts: [acceptReceipt, w3sAcceptReceipt],
  })
  const messageWrite = await context.agentStore.messages.write({
    source: await Transport.outbound.encode(message),
    data: message,
    index: [...AgentMessage.index(message)],
  })
  if (messageWrite.error) {
    return messageWrite
  }

  // if accept task was not successful do not register the blob in the space
  if (acceptReceipt.out.error) {
    return acceptReceipt.out
  }

  const register = await context.registry.register({
    space: /** @type {API.SpaceDID} */ (DID.decode(allocate.nb.space).did()),
    cause: allocate.nb.cause,
    blob: {
      digest: Digest.decode(allocate.nb.blob.digest),
      size: allocate.nb.blob.size,
    },
  })
  if (register.error) {
    // it's ok if there's already a registration of this blob in this space
    if (register.error.name !== 'EntryExists') {
      return register
    }
  }

  return { ok: {} }
}
