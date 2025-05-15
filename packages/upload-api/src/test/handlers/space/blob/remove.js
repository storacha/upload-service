import * as API from '../../../../types.js'
import { sha256 } from 'multiformats/hashes/sha2'
import * as SpaceBlobCapabilities from '@storacha/capabilities/space/blob'
import { createServer, connect } from '../../../../lib.js'
import { alice, registerSpace } from '../../../util.js'
import { uploadBlob } from '../../../helpers/blob.js'

/**
 * @type {API.Tests}
 */
export const test = {
  'space/blob/remove returns receipt with blob size for content allocated in space':
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

      await uploadBlob(
        {
          issuer: alice,
          audience: context.id,
          with: spaceDid,
          proofs: [proof],
          connection,
        },
        { digest, bytes: data }
      )

      // invoke `blob/remove`
      const blobRemoveInvocation = SpaceBlobCapabilities.remove.invoke({
        issuer: alice,
        audience: context.id,
        with: spaceDid,
        nb: {
          digest: digest.bytes,
        },
        proofs: [proof],
      })
      const blobRemove = await blobRemoveInvocation.execute(connection)
      if (!blobRemove.out.ok) {
        throw new Error('invocation failed', { cause: blobRemove.out.error })
      }

      assert.ok(blobRemove.out.ok)
      assert.equal(blobRemove.out.ok.size, size)
    },
  'space/blob/remove returns receipt with size 0 for non existent content in space':
    async (assert, context) => {
      const { proof, spaceDid } = await registerSpace(alice, context)

      // prepare data
      const data = new Uint8Array([11, 22, 34, 44, 55])
      const multihash = await sha256.digest(data)
      const digest = multihash.bytes

      // create service connection
      const connection = connect({
        id: context.id,
        channel: createServer(context),
      })

      // invoke `blob/remove`
      const blobRemoveInvocation = SpaceBlobCapabilities.remove.invoke({
        issuer: alice,
        audience: context.id,
        with: spaceDid,
        nb: {
          digest,
        },
        proofs: [proof],
      })
      const blobRemove = await blobRemoveInvocation.execute(connection)
      if (!blobRemove.out.ok) {
        throw new Error('invocation failed', { cause: blobRemove.out.error })
      }

      assert.ok(blobRemove.out.ok)
      assert.equal(blobRemove.out.ok.size, 0)
    },
}
