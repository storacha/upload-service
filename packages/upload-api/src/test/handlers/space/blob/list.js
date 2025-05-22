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
  'space/blob/list does not fail for empty list': async (assert, context) => {
    const { proof, spaceDid } = await registerSpace(alice, context)
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const blobList = await SpaceBlobCapabilities.list
      .invoke({
        issuer: alice,
        audience: connection.id,
        with: spaceDid,
        proofs: [proof],
        nb: {},
      })
      .execute(connection)

    assert.deepEqual(blobList.out.ok, { results: [], size: 0 })
  },
  'space/blob/list returns blobs previously stored by the user': async (
    assert,
    context
  ) => {
    const { proof, spaceDid } = await registerSpace(alice, context)
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const data = [
      new Uint8Array([11, 22, 34, 44, 55]),
      new Uint8Array([22, 34, 44, 55, 66]),
    ]
    for (const datum of data) {
      await uploadBlob(
        {
          issuer: alice,
          audience: context.id,
          with: spaceDid,
          proofs: [proof],
          connection,
        },
        { digest: await sha256.digest(datum), bytes: datum }
      )
    }

    const blobList = await SpaceBlobCapabilities.list
      .invoke({
        issuer: alice,
        audience: connection.id,
        with: spaceDid,
        proofs: [proof],
        nb: {},
      })
      .execute(connection)

    if (blobList.out.error) {
      throw new Error('invocation failed', { cause: blobList })
    }
    assert.equal(blobList.out.ok.size, data.length)
    // list order last-in-first-out
    const listReverse = await Promise.all(
      data
        .reverse()
        .map(async (datum) => ({ digest: (await sha256.digest(datum)).bytes }))
    )
    assert.deepEqual(
      blobList.out.ok.results.map(({ blob }) => ({ digest: blob.digest })),
      listReverse
    )
  },
  'space/blob/list can be paginated with custom size': async (
    assert,
    context
  ) => {
    const { proof, spaceDid } = await registerSpace(alice, context)
    const connection = connect({
      id: context.id,
      channel: createServer(context),
    })

    const data = [
      new Uint8Array([11, 22, 34, 44, 55]),
      new Uint8Array([22, 34, 44, 55, 66]),
    ]

    for (const datum of data) {
      await uploadBlob(
        {
          issuer: alice,
          audience: context.id,
          with: spaceDid,
          proofs: [proof],
          connection,
        },
        { digest: await sha256.digest(datum), bytes: datum }
      )
    }

    // Get list with page size 1 (two pages)
    const size = 1
    const listPages = []
    /** @type {string} */
    let cursor = ''

    do {
      const blobList = await SpaceBlobCapabilities.list
        .invoke({
          issuer: alice,
          audience: connection.id,
          with: spaceDid,
          proofs: [proof],
          nb: {
            size,
            ...(cursor ? { cursor } : {}),
          },
        })
        .execute(connection)

      if (blobList.out.error) {
        throw new Error('invocation failed', { cause: blobList })
      }

      // Add page if it has size
      if (blobList.out.ok.size > 0) listPages.push(blobList.out.ok.results)

      if (blobList.out.ok.after) {
        cursor = blobList.out.ok.after
      } else {
        break
      }
    } while (cursor)

    assert.equal(
      listPages.length,
      data.length,
      'has number of pages of added CARs'
    )

    // Inspect content
    const blobList = listPages.flat()
    const listReverse = await Promise.all(
      data
        .reverse()
        .map(async (datum) => ({ digest: (await sha256.digest(datum)).bytes }))
    )
    assert.deepEqual(
      blobList.map(({ blob }) => ({ digest: blob.digest })),
      listReverse
    )
  },
}
