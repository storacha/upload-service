import * as BlobReplica from '@storacha/capabilities/blob/replica'
import * as Server from '@ucanto/server'
import { Verifier } from '@ucanto/principal'
import * as Validator from '@ucanto/validator'
import * as API from '../../types.js'
import * as Digest from 'multiformats/hashes/digest'
import { equals } from 'multiformats/bytes'

/**
 * Polls `blob/replica/transfer` task whenever we receive a receipt. It may
 * error if passed a receipt that refers to a `blob/replica/allocate` that we
 * are unable to find or was not issued by us.
 *
 * @param {Pick<API.BlobServiceContext, 'id'|'agentStore'|'replicaStore'> & {
 *   invocation: API.InvocationContext
 * }} context
 * @param {API.Receipt} receipt
 * @param {API.Invocation} transferTask The task referred to by `receipt.ran`.
 * @returns {Promise<API.Result<API.Unit, API.Failure>>}
 */
export const poll = async (context, receipt, transferTask) => {
  const transferMatch = BlobReplica.transfer.match({
    // @ts-expect-error unkown is not transfer caveats
    capability: transferTask.capabilities[0],
    delegation: transferTask,
  })
  // If it's not a receipt for a blob/replica/transfer task, nothing to do here.
  if (transferMatch.error) {
    return Server.ok({})
  }

  const allocTaskLink = transferMatch.ok.value.nb.cause
  const allocTaskGetRes = await context.agentStore.invocations.get(
    allocTaskLink
  )
  if (allocTaskGetRes.error) {
    return allocTaskGetRes
  }

  const allocMatch = BlobReplica.allocate.match({
    // @ts-expect-error unkown is not transfer caveats
    capability: allocTaskGetRes.ok.capabilities[0],
    delegation: allocTaskGetRes.ok,
  })
  if (allocMatch.error) {
    return Server.error({
      name: 'InvalidReplicaTransferCause',
      message:
        'Transfer receipt is for a task with a cause that is not an allocation task',
    })
  }

  // shouldn't happen - we should only store invocations made by our service...
  if (allocTaskGetRes.ok.issuer.did() !== context.id.did()) {
    return Server.error({
      name: 'UnknownReplicaAllocation',
      message: 'Allocation task was not issued by this service',
    })
  }

  // agent that executed the task
  const executor = Verifier.parse(
    (receipt.issuer ?? transferTask.audience).did()
  )
  // verify the signature was signed by the executor
  const verifyRes = await receipt.verifySignature(executor)
  if (verifyRes.error) {
    return verifyRes
  }
  // verify the executor has delegated capability
  const authRes = await Validator.claim(
    BlobReplica.transfer,
    [transferTask, ...receipt.proofs],
    { authority: executor, ...context.invocation }
  )
  if (authRes.error) {
    return authRes
  }

  const transferParams = transferMatch.ok.value.nb
  const allocParams = allocMatch.ok.value.nb
  if (
    !equals(transferParams.blob.digest, allocParams.blob.digest) ||
    transferParams.blob.size !== allocParams.blob.size ||
    transferParams.space.did() !== allocParams.space.did()
  ) {
    return Server.error({
      name: 'ReplicaTransferParameterMismatch',
      message: 'Transfer parameters do not match allocation parameters',
    })
  }

  return context.replicaStore.setStatus(
    {
      space: transferParams.space.did(),
      digest: Digest.decode(transferParams.blob.digest),
      provider: allocTaskGetRes.ok.audience.did(),
    },
    receipt.out.error ? 'failed' : 'transferred'
  )
}
