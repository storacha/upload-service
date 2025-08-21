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
import { now } from '@ipld/dag-ucan'
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
        return Server.error(
          /** @type {API.ReplicationCountRangeError} */ ({
            name: 'ReplicationCountRangeError',
            message: `requested number of replicas is greater than maximum: ${maxReplicas}`,
          })
        )
      }

      const digest = Digest.decode(nb.blob.digest)
      const findRes = await registry.find(space, digest)
      if (findRes.error) {
        if (findRes.error.name === 'EntryNotFound') {
          return Server.error(
            /** @type {API.ReplicationSourceNotFound} */ ({
              name: 'ReplicationSourceNotFound',
              message: `blob not found: ${base58btc.encode(
                digest.bytes
              )} in space: ${space}`,
            })
          )
        }
        return findRes
      }

      // check if we have any active replications
      const replicaListRes = await replicaStore.list({ space, digest })
      if (replicaListRes.error) {
        return replicaListRes
      }

      // TODO: handle the case where a receipt was not received and the replica
      // still exists in "allocated", but has actually timed out/failed.

      const activeReplicas = []
      const failedReplicas = replicaListRes.ok.filter(
        (r) => r.status === 'failed'
      )

      // fetch fx detail for active replicas to include in receipt
      const activeReplicaDetails = await Promise.all(
        replicaListRes.ok
          .filter((r) => r.status !== 'failed')
          .map(async (r) => {
            const fx = await getReplicaFxDetail(context, r.cause)
            return fx.error ? fx : Server.ok({ replica: r, fx: fx.ok })
          })
      )

      const allocTasks = []
      const allocReceipts = []
      const transferTasks = []
      const transferReceipts = []

      for (const res of activeReplicaDetails) {
        if (res.error) {
          return res
        }
        activeReplicas.push(res.ok.replica)
        allocTasks.push(res.ok.fx.allocate.task)
        allocReceipts.push(res.ok.fx.allocate.receipt)
        if (res.ok.fx.transfer) {
          transferTasks.push(res.ok.fx.transfer.task)
          if (res.ok.fx.transfer.receipt) {
            transferReceipts.push(res.ok.fx.transfer.receipt)
          }
        }
      }

      // Note: We +1 below to include the source blob, which is not recorded in
      // the replicas table.
      const newReplicasCount = nb.replicas - (activeReplicas.length + 1)

      // TODO: support reducing the number of replicas
      if (newReplicasCount < 0) {
        return Server.error(
          /** @type {API.ReplicationCountRangeError} */ ({
            name: 'ReplicationCountRangeError',
            message: 'reducing replica count not implemented',
          })
        )
      }

      // lets allocate some replicas!
      if (newReplicasCount > 0) {
        const locClaim = toLocationCommitment(nb.site, invocation.export())
        const authRes = await Validator.claim(Assert.location, [locClaim], {
          authority: context.id,
          ...invContext,
        })
        if (authRes.error) {
          return Server.error(
            /** @type {API.InvalidReplicationSite} */ ({
              name: 'InvalidReplicationSite',
              message: `location commitment validation error: ${authRes.error.message}`,
            })
          )
        }

        // validate location commitment is for the digest we want to replicate
        const locClaimDigest =
          'multihash' in locClaim.capabilities[0].nb.content
            ? locClaim.capabilities[0].nb.content.multihash
            : Digest.decode(locClaim.capabilities[0].nb.content.digest)
        if (!equals(locClaimDigest.bytes, digest.bytes)) {
          return Server.error(
            /** @type {API.InvalidReplicationSite} */ ({
              name: 'InvalidReplicationSite',
              message: `location commitment blob (${base58btc.encode(
                locClaimDigest.bytes
              )}) does not reference replication blob: ${base58btc.encode(
                digest.bytes
              )}`,
            })
          )
        }

        const selectRes = await router.selectReplicationProviders(
          locClaim.issuer,
          newReplicasCount,
          digest,
          nb.blob.size,
          {
            // do not include any nodes where we already have replications or
            // nodes we have previously failed to replicate to
            exclude: [...activeReplicas, ...failedReplicas].map((r) =>
              DID.parse(r.provider)
            ),
          }
        )
        if (selectRes.error) {
          return selectRes
        }

        // if the claim consists of more than one block, add the other
        // blocks to facts so that they can be attached.
        const locClaimBlocks = [...locClaim.export()]
        const allocFacts = /** @type {API.Fact[]} */ ([])
        if (locClaimBlocks.length > 1) {
          allocFacts.push(
            Object.fromEntries(
              locClaimBlocks
                .filter((b) => b.cid.toString() !== locClaim.cid.toString())
                .map((b, i) => [i, b.cid])
            )
          )
        }

        const allocRes = await Promise.all(
          selectRes.ok.map(async (candidate) => {
            const candidateDID = candidate.did()
            const cap = BlobReplica.allocate.create({
              with: candidateDID,
              nb: {
                blob: nb.blob,
                space: DID.parse(space),
                site: nb.site,
                cause: invocation.cid,
              },
            })
            const confRes = await router.configureInvocation(candidate, cap, {
              facts: allocFacts,
              // set the expiration now so that we get the same CID for the task
              // when we call delegate/execute.
              expiration: now() + 30,
            })
            if (confRes.error) {
              return confRes
            }

            const { connection, invocation: allocInv } = confRes.ok

            // attach the location commitment to the allocation invocation
            for (const b of locClaimBlocks) {
              allocInv.attach(b)
            }

            let receipt, execError
            try {
              receipt = await allocInv.execute(connection)
            } catch (/** @type {any} */ err) {
              // allow continuation so failure can be recorded and a retry will
              // not select the same node
              console.warn(`allocating ${candidateDID}`, err)
              execError = err
            }
            const task = await allocInv.delegate()

            // record the invocation and the receipt, so we can retrieve it later
            // when we get a blob/replica/transfer receipt in ucan/conclude
            const message = await Message.build({
              invocations: [task],
              receipts: receipt ? [receipt] : undefined,
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
              status: !receipt || receipt.out.error ? 'failed' : 'allocated',
              cause:
                /** @type {API.UCANLink<[API.BlobReplicaAllocate]>} */
                (task.cid),
            })
            if (addRes.error) {
              return addRes
            }

            // if there no receipt, then an execution error occurred
            if (!receipt) {
              return Server.error({
                name: 'AllocationExecutionFailure',
                message: `failed allocation invocation execution to ${candidateDID}: ${execError}`,
              })
            }

            return receipt
          })
        )

        for (let i = 0; i < allocRes.length; i++) {
          const receipt = allocRes[i]
          if ('error' in receipt) {
            return receipt
          }

          // if allocate invocation was executed but resulted in an error...
          if (receipt.out.error != null) {
            const candidate = selectRes.ok[i]
            return Server.error({
              name: 'AllocationFailure',
              message: `failed to allocate on candidate: ${candidate.did()}`,
              cause: receipt.out.error,
            })
          }

          const transfer = receipt.fx.fork.find(isBlobReplicaTransfer)
          if (!transfer) {
            return Server.error({
              name: 'MissingEffect',
              message: 'missing blob replica transfer effect',
            })
          }

          allocTasks.push(receipt.ran)
          allocReceipts.push(receipt)
          transferTasks.push(transfer)
        }
      }

      const site = transferTasks.map((t) => ({
        'ucan/await': ['.out.ok.site', t.cid],
      }))
      /** @type {API.OkBuilder<API.SpaceBlobReplicateSuccess, API.Failure> | API.ForkBuilder<API.SpaceBlobReplicateSuccess, API.Failure>} */
      let result = Server.ok(
        /** @type {API.SpaceBlobReplicateSuccess} */ ({ site })
      )
      for (const t of allocTasks) {
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
    agentStore.receipts.get(allocTaskLink),
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
    agentStore.receipts.get(transferTaskLink),
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
      transfer: { task: transferTask },
    })
  }

  const transferRcpt =
    /** @type {API.Receipt<API.BlobReplicaTransferSuccess, API.Failure>} */
    (/** @type {unknown} */ (transferRcptRes.ok))

  return Server.ok({
    allocate: { task: allocTask, receipt: allocRcpt },
    transfer: { task: transferTask, receipt: transferRcpt },
  })
}

/**
 * @param {API.Effect} fx
 * @returns {fx is API.Delegation<[API.BlobReplicaTransfer]>}
 */
const isBlobReplicaTransfer = (fx) =>
  Delegation.isDelegation(fx) &&
  fx.capabilities[0].can === BlobReplica.transfer.can
