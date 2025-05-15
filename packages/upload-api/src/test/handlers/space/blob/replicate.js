import * as API from '../../../../types.js'
import { sha256 } from 'multiformats/hashes/sha2'
import { Schema, Receipt, DID } from '@ucanto/core'
import { isDelegation } from '@ucanto/core/delegation'
import { ed25519 } from '@ucanto/principal'
import * as SpaceBlobCapabilities from '@storacha/capabilities/space/blob'
import * as BlobReplicaCapabilities from '@storacha/capabilities/blob/replica'
import * as UCANCapabilities from '@storacha/capabilities/ucan'
import { createServer, connect } from '../../../../lib.js'
import { alice, randomBytes, registerSpace } from '../../../util.js'
import { createLocationCommitment, uploadBlob } from '../../../helpers/blob.js'
import * as Result from '../../../helpers/result.js'
import { toLocationCommitment } from '../../../../blob/lib.js'

/**
 * @import { AssertLocation } from '@web3-storage/content-claims/capability/api'
 * @typedef {{
 *   connection: API.ConnectionView<API.Service>
 *   data: Uint8Array
 *   digest: API.MultihashDigest
 *   space: API.SpaceDID
 *   proof: API.Delegation
 *   site: API.Delegation<[AssertLocation]>
 * }} TestContext
 */

/**
 * Creates a new server and registers a space for alice. Also uploads some data
 * and returns the location commitment along with other context.
 *
 * @param {API.Test<API.UcantoServerTestContext & TestContext>} testFn
 * @returns {API.Test}
 */
const withTestContext = testFn => async (assert, context) => {
  const { proof, spaceDid: space } = await registerSpace(alice, context)
  const data = await randomBytes(32)
  const digest = await sha256.digest(data)

  const server = createServer(context)
  const connection = connect({ id: context.id, channel: server })

  const nextTasks = await uploadBlob(
    {
      issuer: alice,
      audience: context.id,
      with: space,
      proofs: [proof],
      connection,
    },
    { digest, bytes: data }
  )

  const acceptTask = nextTasks.accept.task
  // Get the location claim (usually received via receipts endpoint) but
  // is mocked in testing so we retrieve from the agent message store.
  const acceptRcpt =
    Result.unwrap(await context.agentStore.receipts.get(acceptTask.cid))

  const { site: siteLink } =
    /** @type {API.BlobAcceptSuccess} */
    (Result.unwrap(acceptRcpt.out))

  const site = toLocationCommitment(siteLink, acceptRcpt.iterateIPLDBlocks())

  return testFn(
    assert,
    { ...context, connection, data, digest, space, proof, site }
  )
}

/** @type {API.Tests} */
export const test = {
  'should schedule allocation and return effects for allocate (and its receipt) and transfer':
    withTestContext(async (assert, context) => {
      assert.ok(context.maxReplicas >= 2, 'test requires at least 2 max replicas')

      const replicas = 2
      const replicateRcpt = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: context.digest.bytes,
            size: context.data.length,
          },
          replicas,
          site: context.site.cid,
        },
        proofs: [context.proof, context.site],
      }).execute(context.connection)

      const { site: replicationSite } = Result.unwrap(replicateRcpt.out)

      const replicateRcptBlocks = new Map()
      for (const b of replicateRcpt.iterateIPLDBlocks()) {
        replicateRcptBlocks.set(b.cid.toString(), b)
      }

      // should be blocked on 2x sites (location commitments)
      assert.equal(replicationSite.length, replicas)
      for (const s of replicationSite) {
        assert.equal(s['ucan/await']?.[0], '.out.ok.site')
        assert.ok(Schema.link().is(s['ucan/await']?.[1]))
      }

      // 2x blob/allocate, 2x blob/transfer and 2x ucan/conclude<blob/allocate>
      assert.equal(replicateRcpt.fx.fork.length, 6)

      const allocateFxMatches = []
      const transferFxMatches = []
      const concludeFxMatches = []
      for (const fx of replicateRcpt.fx.fork) {
        if (!isDelegation(fx)) {
          continue
        }
        const allocateMatch = BlobReplicaCapabilities.allocate.match({
          // @ts-expect-error unknown is not allocate caps
          capability: fx.capabilities[0],
          delegation: fx
        })
        if (allocateMatch.ok) {
          allocateFxMatches.push(allocateMatch.ok)
          continue
        }
        const transferMatch = BlobReplicaCapabilities.transfer.match({
          // @ts-expect-error unknown is not transfer caps
          capability: fx.capabilities[0],
          delegation: fx
        })
        if (transferMatch.ok) {
          transferFxMatches.push(transferMatch.ok)
          continue
        }
        const concludeMatch = UCANCapabilities.conclude.match({
          // @ts-expect-error unknown is not conclude caps
          capability: fx.capabilities[0],
          delegation: fx
        })
        if (concludeMatch.ok) {
          concludeFxMatches.push(concludeMatch.ok)
          continue
        }
      }
      assert.equal(allocateFxMatches.length, 2)
      assert.equal(concludeFxMatches.length, 2)
      assert.equal(transferFxMatches.length, 2)

      for (const c of concludeFxMatches) {
        const root =
          /** @type {API.Link<API.ReceiptModel<API.BlobReplicaAllocateSuccess, API.BlobReplicaAllocateFailure>>} */
          (c.value.nb.receipt)
        const receipt = Receipt.view({ root, blocks: replicateRcptBlocks })
        // ensure receipt is not error
        assert.equal(receipt.out.error, undefined)
        // ensure this is a receipt for one of our allocations
        assert.ok(allocateFxMatches.some(a => {
          const ranLink = isDelegation(receipt.ran) ? receipt.ran.cid : receipt.ran
          return a.source[0].delegation.cid.toString() === ranLink.toString()
        }))
        const { size, site } = Result.unwrap(receipt.out)
        // should not be zero as this is new
        assert.equal(size, context.data.length)
        assert.equal(site['ucan/await'][0], '.out.ok.site')
        assert.ok(Schema.link().is(site['ucan/await'][1]))
      }
    }),
  'should not replicate more than configured max replicas':
    withTestContext(async (assert, context) => {
      const replicateRcpt = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: context.digest.bytes,
            size: context.data.length,
          },
          replicas: context.maxReplicas + 1,
          site: context.site.cid,
        },
        proofs: [context.proof, context.site],
      }).execute(context.connection)

      assert.equal(replicateRcpt.out.ok, undefined)
      assert.equal(replicateRcpt.out.error?.name, 'ReplicationCountRangeError')
    }),
  'should not replicate if blob not registered in space':
    withTestContext(async (assert, context) => {
      const data = await randomBytes(32)
      const digest = await sha256.digest(data)
      const site = await createLocationCommitment(
        {
          issuer: alice,
          with: alice.did(),
          audience: alice,
          digest,
          location: /** @type {API.URI} */ ('http://localhost/test'),
          space: DID.parse(context.space),
        }
      ).delegate()

      const replicateRcpt = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: digest.bytes,
            size: data.length,
          },
          replicas: context.maxReplicas,
          site: site.cid,
        },
        proofs: [context.proof, site],
      }).execute(context.connection)

      assert.equal(replicateRcpt.out.ok, undefined)
      assert.equal(replicateRcpt.out.error?.name, 'ReplicationSourceNotFound')
    }),
  'should not replicate if total replicas exceeds max':
    withTestContext(async (assert, context) => {
      const replicateRcpt0 = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: context.digest.bytes,
            size: context.data.length,
          },
          replicas: context.maxReplicas,
          site: context.site.cid,
        },
        proofs: [context.proof, context.site],
      }).execute(context.connection)

      assert.equal(replicateRcpt0.out.error, undefined)
      assert.ok(replicateRcpt0.out.ok)

      // replicate again, exceeding the maximum replicas that can be allocated
      const replicateRcpt1 = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: context.digest.bytes,
            size: context.data.length,
          },
          replicas: 1,
          site: context.site.cid,
        },
        proofs: [context.proof, context.site],
      }).execute(context.connection)

      assert.equal(replicateRcpt1.out.ok, undefined)
      assert.equal(replicateRcpt1.out.error?.name, 'ReplicationCountRangeError')
    }),
  'should not replicate if location commitment is invalid':
    withTestContext(async (assert, context) => {
      // create an invalid location commitment - on a resource alice does not
      // have authority over
      const site = await createLocationCommitment(
        {
          issuer: alice,
          with: (await ed25519.generate()).did(),
          audience: alice,
          digest: context.digest,
          location: /** @type {API.URI} */ ('http://localhost/test'),
          space: DID.parse(context.space),
        }
      ).delegate()

      const replicateRcpt = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: context.digest.bytes,
            size: context.data.length,
          },
          replicas: context.maxReplicas,
          site: site.cid,
        },
        proofs: [context.proof, site],
      }).execute(context.connection)

      assert.equal(replicateRcpt.out.ok, undefined)
      assert.equal(replicateRcpt.out.error?.name, 'InvalidReplicationSite')
    }),
  'should not replicate if location commitment is not for requested blob':
    withTestContext(async (assert, context) => {
      const data = await randomBytes(32)
      const digest = await sha256.digest(data)
      const site = await createLocationCommitment(
        {
          issuer: alice,
          with: alice.did(),
          audience: alice,
          digest: digest,
          location: /** @type {API.URI} */ ('http://localhost/test'),
          space: DID.parse(context.space),
        }
      ).delegate()

      const replicateRcpt = await SpaceBlobCapabilities.replicate.invoke({
        issuer: alice,
        audience: context.id,
        with: context.space,
        nb: {
          blob: {
            digest: context.digest.bytes,
            size: context.data.length,
          },
          replicas: context.maxReplicas,
          site: site.cid,
        },
        proofs: [context.proof, site],
      }).execute(context.connection)

      assert.equal(replicateRcpt.out.ok, undefined)
      assert.equal(replicateRcpt.out.error?.name, 'InvalidReplicationSite')
    }),
}
