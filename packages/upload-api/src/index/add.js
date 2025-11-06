import * as Server from '@ucanto/server'
import { ok, error } from '@ucanto/server'
import * as SpaceIndex from '@storacha/capabilities/space/index'
import * as SpaceContent from '@storacha/capabilities/space/content'
import { ShardedDAGIndex } from '@storacha/blob-index'
import { Assert } from '@web3-storage/content-claims/capability'
import { concat } from 'uint8arrays'
import { Delegation } from '@ucanto/core'
import * as Link from 'multiformats/link'
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
const add = async ({ capability, invocation }, context) => {
  const space = capability.with
  const contentLink = capability.nb.content
  const idxLink = capability.nb.index

  const [providersRes, idxAllocRes] = await Promise.all([
    context.provisionsStorage.getStorageProviders(space),
    // ensure the index was stored in the agent's space
    assertRegistered(context, space, idxLink.multihash, 'IndexNotFound'),
  ])
  if (providersRes.error) return providersRes
  if (idxAllocRes.error) return idxAllocRes

  // If content link is set then a retrieval authorization for the index must
  // also be provided. It means we can skip fetching the index here, and
  // delegate that task to the indexer (which has to do that anyway to index the
  // content).
  if (contentLink) {
    const retrievalAuthResult = extractContentRetrieveDelegation(invocation)
    if (retrievalAuthResult.error) {
      return retrievalAuthResult
    }

    // re-delegate to the indexing service
    const indexerRetrievalAuth = await SpaceContent.retrieve.delegate({
      issuer: context.indexingService.invocationConfig.issuer,
      audience: context.indexingService.invocationConfig.audience,
      with: space,
      nb: retrievalAuthResult.ok.capabilities[0].nb,
      proofs: [retrievalAuthResult.ok],
    })

    const pubRes = await publishIndexClaim(context, {
      content: contentLink,
      index: idxLink,
      providers: providersRes.ok,
      retrievalAuth: indexerRetrievalAuth,
    })
    if (pubRes.error) {
      console.error('failed to publish assert/index claim', pubRes.error)
      return Server.error({
        name: 'PublishFailure',
        message: `failed to publish assert/index claim: ${pubRes.error.message}`,
        cause: pubRes.error,
      })
    }
    return Server.ok({})
  }

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

  const idxRes = ShardedDAGIndex.extract(concat(chunks))
  if (!idxRes.ok) return idxRes

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
 *   retrievalAuth?: API.Delegation
 * }} params Retrieval auth is unused for legacy spaces.
 */
const publishIndexClaim = async (
  ctx,
  { content, index, providers, retrievalAuth }
) => {
  const params = { nb: { content, index }, expiration: Infinity }
  // if legacy provider, publish claim to legacy content claims service
  const isLegacy = providers.some(isW3sProvider)
  let res
  if (isLegacy) {
    res = await Assert.index
      .invoke({ ...ctx.claimsService.invocationConfig, ...params })
      .execute(ctx.claimsService.connection)
  } else {
    const facts = /** @type {Record<string, API.UnknownLink>} */ ({})
    const attachedBlocks = /** @type {API.BlockStore<unknown>} */ (new Map())
    // if we have a retrieval auth, link to it from facts and attach the blocks
    if (retrievalAuth) {
      facts.retrievalAuth = retrievalAuth.link()
      for (const b of retrievalAuth.export()) {
        // @ts-expect-error
        attachedBlocks.set(b.cid.toString(), b)
        facts[b.cid.toString()] = b.cid
      }
    }
    res = await Assert.index
      .invoke({
        ...ctx.indexingService.invocationConfig,
        ...params,
        facts: [facts],
        attachedBlocks,
      })
      .execute(ctx.indexingService.connection)
  }
  return res.out
}

/** @param {API.Invocation} invocation */
const extractContentRetrieveDelegation = (invocation) => {
  /** @type {API.Link|undefined} */
  const root = invocation.facts
    .filter((f) => Boolean(f['retrievalAuth']))
    .map((f) => Link.parse(String(f['retrievalAuth'])).toV1())
    .find(() => true)

  if (!root) {
    return Server.error({
      name: 'RetrievalAuthorizationNotFound',
      message: 'retrieval authorization delegation link not found in facts',
    })
  }
  const blocks =
    /** @type {Server.API.BlockStore<unknown>} */
    (new Map([...invocation.export()].map((b) => [b.cid.toString(), b])))
  try {
    const delegation = Delegation.view({ root, blocks })
    const match = SpaceContent.retrieve.match({
      // @ts-expect-error
      capability: delegation.capabilities[0],
      delegation,
    })
    if (match.error) throw match.error
    return Server.ok(
      /** @type {API.Delegation<[API.InferDelegatedCapability<typeof match.ok.value>]>} */
      (delegation)
    )
  } catch (/** @type {any} */ err) {
    console.error('invalid retrieval authorization', err)
    return Server.error({
      name: 'InvalidRetrievalAuthorization',
      message: `invalid retrieval authorization: ${err.message}`,
    })
  }
}
