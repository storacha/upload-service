import * as API from '../../../../types.js'
import { sha256 } from 'multiformats/hashes/sha2'
import { ed25519 } from '@ucanto/principal'
import { Receipt } from '@ucanto/core'
import * as SpaceBlobCapabilities from '@storacha/capabilities/space/blob'
import * as DID from '@ipld/dag-ucan/did'
import { createServer, connect } from '../../../../lib.js'
import { alice, registerSpace } from '../../../util.js'
import { createConcludeInvocation } from '../../../../ucan/conclude.js'
import { createLocationCommitment, parseBlobAddReceiptNext } from '../../../helpers/blob.js'
import { BlobSizeLimitExceededError } from '../../../../blob.js'

/**
 * @type {API.Tests}
 */
export const test = {
  'space/blob/replicate schedules allocation and returns effects for allocate (and its receipt) and transfer':
      async (assert, context) => {
        const { proof, spaceDid } = await registerSpace(alice, context)
  
        // prepare data
        const data = new Uint8Array([11, 22, 34, 44, 55])
        const digest = await sha256.digest(data)
        const size = data.byteLength
  
        // create service connection
        const connection = connect({
          id: context.id,
          channel: createServer(context),
        })

        const lcomm = await createLocationCommitment({
          issuer: context.id,
          audience: context.id,
          with: spaceDid,
          digest,
          location: 'http://localhost/test',
          space: DID.parse(spaceDid)
        }).delegate()
  
        // invoke `space/blob/replicate`
        const invocation = SpaceBlobCapabilities.replicate.invoke({
          issuer: alice,
          audience: context.id,
          with: spaceDid,
          nb: {
            blob: {
              digest: digest.bytes,
              size,
            },
            replicas: 2,
            site: lcomm.cid,
          },
          proofs: [proof],
        })
        const blobReplicate = await invocation.execute(connection)
        if (!blobReplicate.out.ok) {
          throw new Error('invocation failed', { cause: blobReplicate })
        }

        // 2x blob/allocate and 2x blob/transfer
        assert.equal(blobReplicate.fx.fork.length, 4)
  
        // const next = parseBlobAddReceiptNext(blobReplicate)
  
        // // Validate receipt structure
        // assert.ok(blobReplicate.out.ok.site)
        // assert.equal(blobReplicate.out.ok.site['ucan/await'][0], '.out.ok.site')
        // assert.deepEqual(
        //   blobReplicate.out.ok.site['ucan/await'][1],
        //   next.accept.task.cid
        // )
        // assert.equal(blobReplicate.fx.fork.length, 7)
  
        // // validate receipt next
        // assert.ok(next.allocate.task)
        // assert.ok(next.put.task)
        // assert.ok(next.accept.task)
        // assert.ok(next.allocate.receipt)
        // assert.ok(!next.put.receipt)
        // assert.ok(!next.accept.receipt)
  
        // // validate facts exist for `http/put`
        // assert.ok(next.put.task.facts.length)
        // assert.ok(next.put.task.facts[0]['keys'])
  
        // // Validate `http/put` invocation was stored
        // const httpPutGetTask = await context.agentStore.invocations.get(
        //   next.put.task.cid
        // )
        // assert.ok(httpPutGetTask.ok)
  
        // // validate that scheduled allocate task executed and has its receipt content
        // const receipt = next.allocate.receipt
        // assert.ok(receipt.out)
        // assert.ok(receipt.out.ok)
        // assert.equal(receipt.out.ok?.size, size)
        // assert.ok(receipt.out.ok?.address)
      },
}
