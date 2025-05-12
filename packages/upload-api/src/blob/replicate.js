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
import { isBlobReplicaTransfer, toLocationCommitmentView } from './lib.js'
import { createConcludeInvocation } from '../ucan/conclude.js'

/**
 * @param {API.BlobServiceContext} context
 * @returns {API.ServiceMethod<API.SpaceBlobReplicate, API.SpaceBlobReplicateSuccess, API.SpaceBlobReplicateFailure>}
 */
export const blobReplicateProvider = (context) => {
  const { router, registry, replicaStore, agentStore } = context
  const maxReplicas = context.maxReplicas ?? 2
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
      const replicaListRes = await replicaStore.list(space, digest)
      if (replicaListRes.error) {
        return replicaListRes
      }

      // TODO: handle the case where a receipt was not received and the replica
      // still exists in "allocated", but has actually timed out/failed.
      const existingReplicas = replicaListRes.ok.filter(r => r.status === 'failed')
      if (existingReplicas.length + nb.replicas > maxReplicas) {
        return Server.error(/** @type {API.ReplicationCountRangeError} */ ({
          name: 'ReplicationCountRangeError',
          message: `total number of replicas is greater than maximum: ${maxReplicas}`
        }))
      }

      const lcomm = toLocationCommitmentView(nb.site, invocation.export())
      const authRes = await Validator.claim(Assert.location, [lcomm], {
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
      const lcommDigest = 'multihash' in lcomm.capabilities[0].nb.content
        ? lcomm.capabilities[0].nb.content.multihash
        : Digest.decode(lcomm.capabilities[0].nb.content.digest)
      if (!equals(lcommDigest.bytes, digest.bytes)) {
        return Server.error(/** @type {API.InvalidReplicationSite} */ ({
          name: 'InvalidReplicationSite',
          message: `location commitment blob (${base58btc.encode(lcommDigest.bytes)}) does not reference replication blob: ${base58btc.encode(digest.bytes)}`
        }))
      }

      const selectRes = await router.selectReplicationProviders(
        lcomm.issuer,
        nb.replicas,
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

        const addRes = await replicaStore.add(
          candidateDID,
          space,
          digest,
          receipt.out.error ? 'failed' : 'allocated',
          task.cid
        )
        return addRes.error ? addRes : receipt
      }))

      const allocReceipts = []
      const transferTasks = []
      for (const receipt of allocRes) {
        if ('error' in receipt) {
          return receipt
        }

        const transfer = receipt.fx.fork.find(isBlobReplicaTransfer)
        if (!transfer) {
          return Server.error(new Error('missing blob replica transfer effect'))
        }

        allocReceipts.push(receipt)
        transferTasks.push(transfer)
      }

      const site = transferTasks.map(t => ({
        'ucan/await': ['.out.ok.site', t.cid]
      }))
      let result = Server
        .ok(/** @type {API.SpaceBlobReplicateSuccess} */ ({ site }))
        // add allocation tasks
        .fork(allocReceipts[0].ran)
      for (const r of allocReceipts.slice(1)) {
        result = result.fork(r.ran)
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

      return result
    },
  })
}
