import * as API from '../../types.js'
import { ed25519 } from '@ucanto/principal'
import { sha256 } from 'multiformats/hashes/sha2'
import { equals } from 'multiformats/bytes'
import { randomBytes, randomCID, randomChoice } from '../util.js'
import * as Result from '../helpers/result.js'

/**
 * @param {object} [options]
 * @param {API.SpaceDID} [options.space]
 * @param {API.MultihashDigest} [options.digest]
 * @param {API.DID} [options.provider]
 * @param {API.BlobAPI.ReplicationStatus} [options.status]
 * @param {API.UCANLink<[API.BlobReplicaAllocate]>} [options.cause]
 */
const createReplica = async ({
  space,
  digest,
  provider,
  status,
  cause,
} = {}) => ({
  space: space ?? (await ed25519.generate()).did(),
  digest: digest ?? (await sha256.digest(await randomBytes(32))),
  provider: provider ?? (await ed25519.generate()).did(),
  status: status ?? randomChoice(['allocated', 'transferred', 'failed']),
  cause: cause ?? (await randomCID()),
})

/**
 * @type {API.Tests}
 */
export const test = {
  'should add a replica': async (assert, { replicaStore }) => {
    const r = await createReplica()
    const addRes = await replicaStore.add(r)
    assert.equal(addRes.error, undefined)
  },
  'should not add the same replica twice': async (assert, { replicaStore }) => {
    const r0 = await createReplica()
    const addRes = await replicaStore.add(r0)
    assert.equal(addRes.error, undefined)

    // same replica with different status/cause
    const r1 = await createReplica({
      space: r0.space,
      digest: r0.digest,
      provider: r0.provider,
    })
    const { error } = await replicaStore.add(r1)
    assert.equal(error?.name, 'ReplicaExists')
  },
  'should list replicas': async (assert, { replicaStore }) => {
    const r0 = await createReplica()
    // for the same space/blob
    const r1 = await createReplica({
      space: r0.space,
      digest: r0.digest,
      cause: r0.cause,
    })
    // unrelated
    const r2 = await createReplica()
    for (const r of [r0, r1, r2]) {
      const addRes = await replicaStore.add(r)
      assert.equal(addRes.error, undefined)
    }
    const results = Result.unwrap(
      await replicaStore.list({
        space: r0.space,
        digest: r0.digest,
      })
    )
    assert.equal(results.length, 2)

    for (const expectedReplica of [r0, r1]) {
      const actualReplica = results.find(
        (r) =>
          r.space === expectedReplica.space &&
          equals(r.digest.bytes, expectedReplica.digest.bytes) &&
          r.provider === expectedReplica.provider
      )
      assert.ok(actualReplica)
      assert.equal(actualReplica?.status, expectedReplica.status)
      assert.equal(
        actualReplica?.cause.toString(),
        expectedReplica.cause.toString()
      )
    }
  },
  'should set replica status': async (assert, { replicaStore }) => {
    const r = await createReplica({ status: 'allocated' })
    const addRes = await replicaStore.add(r)
    assert.equal(addRes.error, undefined)

    const results0 = Result.unwrap(
      await replicaStore.list({
        space: r.space,
        digest: r.digest,
      })
    )
    assert.equal(results0.length, 1)
    assert.equal(results0[0].status, 'allocated')

    const statusRes = await replicaStore.setStatus(
      { space: r.space, digest: r.digest, provider: r.provider },
      'transferred'
    )
    assert.equal(statusRes.error, undefined)

    const results1 = Result.unwrap(
      await replicaStore.list({
        space: r.space,
        digest: r.digest,
      })
    )
    assert.equal(results1.length, 1)
    assert.equal(results1[0].status, 'transferred')
  },
  'should fail to set replica status if not exists': async (
    assert,
    { replicaStore }
  ) => {
    // create but do not add
    const r = await createReplica()
    const statusRes = await replicaStore.setStatus(
      { space: r.space, digest: r.digest, provider: r.provider },
      'transferred'
    )
    assert.equal(statusRes.ok, undefined)
    assert.equal(statusRes.error?.name, 'ReplicaNotFound')
  },
}
