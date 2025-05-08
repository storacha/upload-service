import * as Server from '@ucanto/server'
import { Delegation } from '@ucanto/core'
import * as Validator from '@ucanto/validator'
import { Verifier } from '@ucanto/principal'
import * as SpaceBlob from '@storacha/capabilities/space/blob'
import * as BlobReplica from '@storacha/capabilities/blob/replica'
import * as Assert from '@web3-storage/content-claims/capability/assert'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import * as DID from '@ipld/dag-ucan/did'
import * as API from '../types.js'

/** @import { AssertLocation } from '@web3-storage/content-claims/capability/api' */

/**
 * @param {API.BlobServiceContext} context
 * @returns {API.ServiceMethod<API.SpaceBlobReplicate, API.SpaceBlobReplicateSuccess, API.SpaceBlobReplicateFailure>}
 */
export const blobReplicateProvider = (context) => {
  const { router, registry, replicaStore } = context
  const maxReplicas = context.maxReplicas ?? 2
  return Server.provideAdvanced({
    capability: SpaceBlob.replicate,
    handler: async ({ capability, invocation }) => {
      const { with: space, nb } = capability

      if (nb.replicas > maxReplicas) {
        return /** @type {API.ReplicationCountRangeError} */ ({
          name: 'ReplicationCountRangeError',
          message: `requested number of replicas is greater than maximum: ${maxReplicas}`
        })
      }

      const digest = Digest.decode(nb.blob.digest)
      const findRes = await registry.find(space, digest)
      if (findRes.error) {
        if (findRes.error.name === 'EntryNotFound') {
          return /** @type {API.ReplicationSourceNotFound} */ ({
            name: 'ReplicationSourceNotFound',
            message: `blob not found: ${base58btc.encode(digest.bytes)} in space: ${space}`
          })
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
        return /** @type {API.ReplicationCountRangeError} */ ({
          name: 'ReplicationCountRangeError',
          message: `total number of replicas is greater than maximum: ${maxReplicas}`
        })
      }

      const lcomm = locationCommitmentView(nb.site, invocation.export())
      const authRes = await Validator.claim(Assert.location, [lcomm], {
        authority: context.id,
        principal: Verifier,
        // TODO: check revocation status
        validateAuthorization: async () => ({ ok: true }),
      })
      if (authRes.error) {
        return authRes
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
        const inv = await router.configureInvocation(candidate, {
          can: BlobReplica.allocate.can,
          with: candidate.did(),
          nb: {
            blob: nb.blob,
            space: DID.parse(space),
            site: nb.site,
            cause: invocation.cid
          }
        })
        const addReplicaRes = await replicaStore.addAllocated(
          candidate.did(),
          space,
          digest,
          invocation.cid
        )
      }))
    },
  })
}

/**
 * @param {API.Link} root 
 * @param {Iterable<API.Block>} blocks
 * @returns {API.Delegation<[AssertLocation]>}
 */
const locationCommitmentView = (root, blocks) => {
  const blockStore = new Map()
  for (const b of blocks) {
    blockStore.set(b.cid.toString(), b)
  }
  return Delegation.view({ root, blocks: blockStore })
}
