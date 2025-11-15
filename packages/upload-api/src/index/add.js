import * as Server from '@ucanto/server'
import { ok, error } from '@ucanto/server'
import * as SpaceIndex from '@storacha/capabilities/space/index'
import { ShardedDAGIndex } from '@storacha/blob-index'
import { Assert } from '@web3-storage/content-claims/capability'
import { concat } from 'uint8arrays'
import * as API from '../types.js'
import { isW3sProvider } from '../web3.storage/blob/lib.js'

/**
 * @param {API.IndexServiceContext} context
 * @returns {API.ServiceMethod<API.SpaceIndexAdd, API.SpaceIndexAddSuccess, API.SpaceIndexAddFailure>}
 */
export const provide = (context) =>
  Server.provide(SpaceIndex.add, (input) => add(input, context))

/**
 * @param {API.Input<SpaceIndex.add>} input
 * @param {API.IndexServiceContext} context
 * @returns {Promise<API.Result<API.SpaceIndexAddSuccess, API.SpaceIndexAddFailure>>}
 */
const add = async ({ capability }, context) => {
  console.error('add called with capability:', capability);
  const space = capability.with
  const idxLink = capability.nb.index

  console.error('assertRegistered')
  const [providersRes, idxAllocRes] = await Promise.all([
    context.provisionsStorage.getStorageProviders(space),
    // ensure the index was stored in the agent's space
    assertRegistered(context, space, idxLink.multihash, 'IndexNotFound'),
  ])
  if (providersRes.error) return providersRes
  if (idxAllocRes.error) return idxAllocRes

  console.error('fetching the index from the network')
  // fetch the index from the network
  const idxBlobRes = await context.blobRetriever.stream(idxLink.multihash)
  if (!idxBlobRes.ok) {
    if (idxBlobRes.error.name === 'BlobNotFound') {
      return error(
        /** @type {API.IndexNotFound} */
        ({ name: 'IndexNotFound', digest: idxLink.multihash.bytes })
      )
    }
    return idxBlobRes
  }

  console.error('parsing index')
  /** @type {Uint8Array[]} */
  const chunks = []

  try {
    await idxBlobRes.ok.pipeTo(
      new WritableStream({
        write: (chunk) => {
          chunks.push(chunk)
        },
      })
    )
  } catch (err) {
    // server may aggressively close the connection - and cause an error, but
    // oftentimes we have all the data, so continue...
    console.warn('failed to stream index blob', err)
  }

  console.error('extracting index')
  const idxRes = ShardedDAGIndex.extract(concat(chunks))
  if (!idxRes.ok) return idxRes

  console.error('ensuring indexed shards are allocated in the agent\'s space')
  // ensure indexed shards are allocated in the agent's space
  const shardDigests = [...idxRes.ok.shards.keys()]
  const shardAllocRes = await Promise.all(
    shardDigests.map((s) =>
      assertRegistered(context, space, s, 'ShardNotFound')
    )
  )
  for (const res of shardAllocRes) {
    if (res.error) return res
  }

  // TODO: randomly validate slices in the index correspond to slices in the blob

  console.error(context.ipniService ? 'publish to IPNI' : 'skip IPNI')
  console.error('publishing index claim')

  const publishRes = await Promise.all([
    // publish the index data to IPNI
    context.ipniService?.publish(space, providersRes.ok, idxRes.ok) ?? ok({}),
    // publish a content claim for the index
    publishIndexClaim(context, {
      content: idxRes.ok.content,
      index: idxLink,
      providers: providersRes.ok,
    }),
  ])
  for (const res of publishRes) {
    if (res.error) return res
  }
  return ok({})
}

/**
 * @param {{ registry: import('../types/blob.js').Registry }} context
 * @param {API.SpaceDID} space
 * @param {import('multiformats').MultihashDigest} digest
 * @param {'IndexNotFound'|'ShardNotFound'|'SliceNotFound'} errorName
 * @returns {Promise<API.Result<API.Unit, API.IndexNotFound|API.ShardNotFound|API.SliceNotFound|API.Failure>>}
 */
const assertRegistered = async (context, space, digest, errorName) => {
  const result = await context.registry.find(space, digest)
  if (result.error) {
    if (result.error.name === 'EntryNotFound') {
      return error(
        /** @type {API.IndexNotFound|API.ShardNotFound|API.SliceNotFound} */
        ({ name: errorName, digest: digest.bytes })
      )
    }
    return result
  }
  return ok({})
}

/**
 * Publishes an index claim to the indexing service. If the space is provisioned
 * with a legacy provider (i.e. did:web:web3.storage) then the index claim is
 * published to the legacy content claims service instead.
 *
 * @param {API.ClaimsClientContext & API.IndexingServiceAPI.Context} ctx
 * @param {{
 *   content: API.UnknownLink
 *   index: API.CARLink
 *   providers: API.ProviderDID[]
 * }} params
 */
const publishIndexClaim = async (ctx, { content, index, providers }) => {
  const params = { nb: { content, index }, expiration: Infinity }
  // if legacy provider, publish claim to legacy content claims service
  const isLegacy = providers.some(isW3sProvider)
  let res
  if (isLegacy) {
    res = await Assert.index
      .invoke({ ...ctx.claimsService.invocationConfig, ...params })
      .execute(ctx.claimsService.connection)
  } else {
    console.error('publishing index claim to indexing service')
    res = await Assert.index
      .invoke({ ...ctx.indexingService.invocationConfig, ...params })
      .execute(ctx.indexingService.connection)
  }

  console.error('published index claim', res.out)
  return res.out
}
