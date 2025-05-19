import * as Server from '@ucanto/server'
import { Delegation, Message } from '@ucanto/core'
import * as Validator from '@ucanto/validator'
import * as Transport from '@ucanto/transport/car'
import * as SpaceBlob from '@storacha/capabilities/space/blob'
import * as BlobReplica from '@storacha/capabilities/blob/replica'
import * as Assert from '@web3-storage/content-claims/capability/assert'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { equals } from 'multiformats/bytes'
import * as DID from '@ipld/dag-ucan/did'
import * as API from '../types.js'
import { AgentMessage } from '../lib.js'
import { toLocationCommitment } from './lib.js'
import { createConcludeInvocation } from '../ucan/conclude.js'

/**
 * @param {API.BlobServiceContext} context
 * @returns {API.ServiceMethod<API.SpaceBlobReplicate, API.SpaceBlobReplicateSuccess, API.SpaceBlobReplicateFailure>}
 */
export const blobReplicateProvider = (context) => {
  const { router, registry, replicaStore, agentStore, maxReplicas } = context
  return Server.provideAdvanced({
    capability: SpaceBlob.replicate,
    handler: async ({ capability, invocation, context: invContext }) => {
      const { with: space, nb } = capability

      if (nb.replicas > maxReplicas) {
        return Server.error(/** @type {API.ReplicationCountRangeError} */ ({
          name: 'ReplicationCountRangeError',
          message: `requested number of replicas is greater than maximum: ${maxReplicas}`
        }))
      }

      const digest = Digest.decode(nb.blob.digest)
      const findRes = await registry.find(space, digest)
      if (findRes.error) {
        if (findRes.error.name === 'EntryNotFound') {
          return Server.error(/** @type {API.ReplicationSourceNotFound} */ ({
            name: 'ReplicationSourceNotFound',
            message: `blob not found: ${base58btc.encode(digest.bytes)} in space: ${space}`
          }))
        }
        return findRes
      }

      // check if we have any existing replicas
      const replicaListRes = await replicaStore.list({ space, digest })
      if (replicaListRes.error) {
        return replicaListRes
      }

      // TODO: handle the case where a receipt was not received and the replica
      // still exists in "allocated", but has actually timed out/failed.

      // fetch fx detail for non-failed existing replicas to include in receipt
      const existingReplicaRes = await Promise.all(
        replicaListRes.ok
          .filter(r => r.status !== 'failed')
          .map(async r => {
            const fx = await getReplicaFxDetail(context, r.cause)
            return fx.error ? fx : Server.ok({ replica: r, fx: fx.ok })
          })
      )

      const existingReplicas = []
      const allocTasks = []
      const allocReceipts = []
      const transferTasks = []
      const transferReceipts = []

      for (const res of existingReplicaRes) {
        if (res.error) return res
        existingReplicas.push(res.ok.replica)
        allocTasks.push(res.ok.fx.allocate.task)
        allocReceipts.push(res.ok.fx.allocate.receipt)
        if (res.ok.fx.transfer) {
          transferTasks.push(res.ok.fx.transfer.task)
          if (res.ok.fx.transfer.receipt) {
            transferReceipts.push(res.ok.fx.transfer.receipt)
          }
        }
      }

      // TODO: support reducing the number of replicas?
      const newReplicasCount = nb.replicas - existingReplicas.length

      // lets allocate some replicas!
      if (newReplicasCount > 0) {
        const claim = toLocationCommitment(nb.site, invocation.export())
        const authRes = await Validator.claim(Assert.location, [claim], {
          authority: context.id,
          ...invContext
        })
        if (authRes.error) {
          return Server.error(/** @type {API.InvalidReplicationSite} */ ({
            name: 'InvalidReplicationSite',
            message: `location commitment validation error: ${authRes.error.message}`
          }))
        }

        // validate location commitment is for the digest we want to replicate
        const claimDigest = 'multihash' in claim.capabilities[0].nb.content
          ? claim.capabilities[0].nb.content.multihash
          : Digest.decode(claim.capabilities[0].nb.content.digest)
        if (!equals(claimDigest.bytes, digest.bytes)) {
          return Server.error(/** @type {API.InvalidReplicationSite} */ ({
            name: 'InvalidReplicationSite',
            message: `location commitment blob (${base58btc.encode(claimDigest.bytes)}) does not reference replication blob: ${base58btc.encode(digest.bytes)}`
          }))
        }

        const selectRes = await router.selectReplicationProviders(
          claim.issuer,
          newReplicasCount,
          digest,
          nb.blob.size,
          { exclude: existingReplicas.map(r => DID.parse(r.provider)) }
        )
        if (selectRes.error) {
          return selectRes
        }

        const allocRes = await Promise.all(selectRes.ok.map(async (candidate) => {
          const candidateDID = candidate.did()
          const confRes = await router.configureInvocation(candidate, {
            can: BlobReplica.allocate.can,
            with: candidateDID,
            nb: {
              blob: nb.blob,
              space: DID.parse(space),
              site: nb.site,
              cause: invocation.cid
            }
          })
          if (confRes.error) {
            return confRes
          }

          const { connection, invocation: allocInv } = confRes.ok

          const receipt = await allocInv.execute(connection)
          const task = receipt.ran
          if (!Delegation.isDelegation(task)) {
            throw new Error('expected receipt ran to be a delegation')
          }

          // record the invocation and the receipt, so we can retrieve it later
          // when we get a blob/replica/transfer receipt in ucan/conclude
          const message = await Message.build({
            invocations: [task],
            receipts: [receipt],
          })
          const messageWriteRes = await agentStore.messages.write({
            source: await Transport.outbound.encode(message),
            data: message,
            index: [...AgentMessage.index(message)],
          })
          if (messageWriteRes.error) {
            return messageWriteRes
          }

          const addRes = await replicaStore.add({
            space,
            digest,
            provider: candidateDID,
            status: receipt.out.error ? 'failed' : 'allocated',
            cause:
              /** @type {API.UCANLink<[API.BlobReplicaAllocate]>} */
              (task.cid)
          })
          return addRes.error ? addRes : receipt
        }))

        for (const receipt of allocRes) {
          if ('error' in receipt) {
            return receipt
          }
  
          const transfer = receipt.fx.fork.find(isBlobReplicaTransfer)
          if (!transfer) {
            return Server.error(new Error('missing blob replica transfer effect'))
          }
  
          allocTasks.push(receipt.ran)
          allocReceipts.push(receipt)
          transferTasks.push(transfer)
        }
      }

      const site = transferTasks.map(t => ({
        'ucan/await': ['.out.ok.site', t.cid]
      }))
      let result = Server
        .ok(/** @type {API.SpaceBlobReplicateSuccess} */ ({ site }))
        // add allocation tasks
        .fork(allocTasks[0])
      for (const t of allocTasks.slice(1)) {
        result = result.fork(t)
      }
      // add transfer tasks
      for (const t of transferTasks) {
        result = result.fork(t)
      }
      // add allocation reciepts
      for (const r of allocReceipts) {
        // as a temporary solution we fork all allocate effects that add inline
        // receipts so they can be delivered to the client.
        result = result.fork(
          await createConcludeInvocation(context.id, context.id, r).delegate()
        )
      }
      // add transfer reciepts
      for (const r of transferReceipts) {
        // as a temporary solution we fork all allocate effects that add inline
        // receipts so they can be delivered to the client.
        result = result.fork(
          await createConcludeInvocation(context.id, context.id, r).delegate()
        )
      }

      return result
    },
  })
}

/**
 * Retrieves details of effect chain for replica allocations.
 * 
 * If the allocation failed (receipt in error) then the return value will not
 * include any details about the transfer. i.e. `transfer` will be `undefined`.
 * 
 * If the receipt for `blob/replica/transfer` was not yet received, it will not
 * be included in the return value. i.e. `transfer.receipt` will be `undefined`.
 *
 * @typedef {{
 *   allocate: {
 *     task: API.Invocation<API.BlobReplicaAllocate>
 *     receipt: API.Receipt<API.BlobReplicaAllocateSuccess, API.Failure>
 *   }
 *   transfer?: {
 *     task: API.Invocation<API.BlobReplicaTransfer>
 *     receipt?: API.Receipt<API.BlobReplicaTransferSuccess, API.Failure>
 *   }
 * }} ReplicaFxDetail
 * @param {Pick<API.BlobServiceContext, 'agentStore'>} context
 * @param {API.UCANLink<[API.BlobReplicaAllocate]>} allocTaskLink
 * @returns {Promise<API.Result<ReplicaFxDetail, API.Failure>>}
 */
const getReplicaFxDetail = async ({ agentStore }, allocTaskLink) => {
  const [allocTaskRes, allocRcptRes] = await Promise.all([
    agentStore.invocations.get(allocTaskLink),
    agentStore.receipts.get(allocTaskLink)
  ])
  if (allocTaskRes.error) {
    return allocTaskRes
  }
  if (allocRcptRes.error) {
    return allocRcptRes
  }

  const allocTask =
    /** @type {API.Invocation<API.BlobReplicaAllocate>} */
    (allocTaskRes.ok)
  
  const allocRcpt = 
    /** @type {API.Receipt<API.BlobReplicaAllocateSuccess, API.Failure>} */
    (/** @type {unknown} */ (allocRcptRes.ok))

  // if allocation failed, we cannot provide details for transfer
  if (allocRcpt.out.error) {
    return Server.ok({ allocate: { task: allocTask, receipt: allocRcpt } })
  }

  const transferTaskLink = allocRcpt.out.ok.site['ucan/await'][1]
  const [transferTaskRes, transferRcptRes] = await Promise.all([
    agentStore.invocations.get(transferTaskLink),
    agentStore.receipts.get(transferTaskLink)
  ])
  if (transferTaskRes.error) {
    return transferTaskRes
  }
  if (transferRcptRes.error) {
    if (transferRcptRes.error.name !== 'RecordNotFound') {
      return transferRcptRes
    }
  }

  const transferTask =
    /** @type {API.Invocation<API.BlobReplicaTransfer>} */
    (transferTaskRes.ok)

  // if conclude for transfer was not received yet then just return the task
  if (transferRcptRes.error?.name === 'RecordNotFound') {
    return Server.ok({
      allocate: { task: allocTask, receipt: allocRcpt },
      transfer: { task: transferTask }
    })
  }

  const transferRcpt =
    /** @type {API.Receipt<API.BlobReplicaTransferSuccess, API.Failure>} */
    (/** @type {unknown} */ (transferRcptRes.ok))
  
  return Server.ok({
    allocate: { task: allocTask, receipt: allocRcpt },
    transfer: { task: transferTask, receipt: transferRcpt }
  })
}

/**
 * @param {API.Effect} fx
 * @returns {fx is API.Delegation<[API.BlobReplicaTransfer]>}
 */
const isBlobReplicaTransfer = fx =>
  Delegation.isDelegation(fx) && fx.capabilities[0].can === BlobReplica.transfer.can
