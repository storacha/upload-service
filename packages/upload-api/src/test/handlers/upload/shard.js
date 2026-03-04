import * as API from '../../types.js'
import { alice, registerSpace, randomCAR } from '../../util.js'
import { createServer, connect } from '../../../lib.js'
import { Upload, UploadShard } from '@storacha/capabilities'

/** @type {API.Tests} */
export const test = {
  'upload/shard/list returns shards for an upload': async (assert, context) => {
    const { proof, spaceDid } = await registerSpace(alice, context)
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const shards = [await randomCAR(128), await randomCAR(128)]

    await Upload.add
      .invoke({
        issuer: alice,
        audience: connection.id,
        with: spaceDid,
        nb: {
          root: shards[0].roots[0],
          shards: [shards[0].cid, shards[1].cid],
        },
        proofs: [proof],
      })
      .execute(connection)

    const uploadShardList = await UploadShard.list
      .invoke({
        issuer: alice,
        audience: connection.id,
        with: spaceDid,
        proofs: [proof],
        nb: {
          root: shards[0].roots[0],
        },
      })
      .execute(connection)

    if (!uploadShardList.out.ok) {
      throw new Error('invocation failed', { cause: uploadShardList })
    }

    assert.equal(uploadShardList.out.ok.size, shards.length)
    assert.deepEqual(
      uploadShardList.out.ok.results.map((r) => r.toString()).sort(),
      shards.map((s) => s.cid.toString()).sort()
    )
  },

  'upload/shard/list can be paginated with custom size': async (
    assert,
    context
  ) => {
    const { proof, spaceDid } = await registerSpace(alice, context)
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const shards = [await randomCAR(128), await randomCAR(128)]

    await Upload.add
      .invoke({
        issuer: alice,
        audience: connection.id,
        with: spaceDid,
        nb: {
          root: shards[0].roots[0],
          shards: [shards[0].cid, shards[1].cid],
        },
        proofs: [proof],
      })
      .execute(connection)

    // Get list with page size 1 (two pages)
    const size = 1
    const listPages = []
    let cursor = ''

    do {
      const uploadList = await UploadShard.list
        .invoke({
          issuer: alice,
          audience: connection.id,
          with: spaceDid,
          proofs: [proof],
          nb: {
            root: shards[0].roots[0],
            size,
            ...(cursor ? { cursor } : {}),
          },
        })
        .execute(connection)

      if (!uploadList.out.ok) {
        throw new Error('invocation failed', { cause: uploadList })
      }

      // Add page if it has size
      if (uploadList.out.ok.size > 0) {
        listPages.push(uploadList.out.ok.results)
      }

      if (uploadList.out.ok.cursor) {
        cursor = uploadList.out.ok.cursor
      } else {
        break
      }
    } while (cursor)

    assert.equal(listPages.length, shards.length)

    const uploadList = listPages.flat()
    assert.deepEqual(
      uploadList.map((r) => r.toString()).sort(),
      shards.map((s) => s.cid.toString()).sort()
    )
  },
}
