import { capability, URI, Schema, ok } from '@ucanto/validator'
import { and, equal, equalLinkOrDigestContent, equalWith } from './utils.js'

const linkOrDigest = () =>
  Schema.link().or(Schema.struct({ digest: Schema.bytes() }))

export const assert = capability({
  can: 'assert/*',
  with: URI.match({ protocol: 'did:' }),
})

/**
 * Claims that a CID is available at a URL.
 */
export const location = capability({
  can: 'assert/location',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    /** Blob CID or multihash */
    content: linkOrDigest(),
    location: Schema.array(URI),
    range: Schema.struct({
      offset: Schema.integer(),
      length: Schema.integer().optional(),
    }).optional(),
    space: Schema.principal().optional(),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equalLinkOrDigestContent(claimed, delegated)) ||
    and(equal(claimed.nb.location, delegated.nb.location, 'location')) ||
    and(
      equal(claimed.nb.range?.offset, delegated.nb.range?.offset, 'offset')
    ) ||
    and(
      equal(claimed.nb.range?.length, delegated.nb.range?.length, 'length')
    ) ||
    and(equal(claimed.nb.space, delegated.nb.space, 'space')) ||
    ok({}),
})

/**
 * Claims that a CID includes the contents claimed in another CID.
 */
export const inclusion = capability({
  can: 'assert/inclusion',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    /** CAR CID */
    content: linkOrDigest(),
    /** CARv2 index CID */
    includes: Schema.link({ version: 1 }),
    proof: Schema.link({ version: 1 }).optional(),
  }),
})

/**
 * Claims that a content graph can be found in blob(s) that are identified and
 * indexed in the given index CID.
 */
export const index = capability({
  can: 'assert/index',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    /** DAG root CID */
    content: linkOrDigest(),
    /**
     * Link to a Content Archive that contains the index.
     * e.g. `index/sharded/dag@0.1`
     *
     * @see https://github.com/storacha/specs/blob/main/w3-index.md
     */
    index: Schema.link({ version: 1 }),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equal(claimed.nb.content, delegated.nb.content, 'content')) ||
    and(equal(claimed.nb.index, delegated.nb.index, 'index')) ||
    ok({}),
})

/**
 * Claims that a CID's graph can be read from the blocks found in parts.
 */
export const partition = capability({
  can: 'assert/partition',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    /** Content root CID */
    content: linkOrDigest(),
    /** CIDs CID */
    blocks: Schema.link({ version: 1 }).optional(),
    parts: Schema.array(Schema.link({ version: 1 })),
  }),
})

/**
 * Claims that a CID links to other CIDs.
 */
export const relation = capability({
  can: 'assert/relation',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    content: linkOrDigest(),
    /** CIDs this content links to directly. */
    children: Schema.array(Schema.link()),
    /** Parts this content and it's children can be read from. */
    parts: Schema.array(
      Schema.struct({
        content: Schema.link({ version: 1 }),
        /** CID of contents (CARv2 index) included in this part. */
        includes: Schema.struct({
          content: Schema.link({ version: 1 }),
          /** CIDs of parts this index may be found in. */
          parts: Schema.array(Schema.link({ version: 1 })).optional(),
        }).optional(),
      })
    ),
  }),
})

/**
 * Claim data is referred to by another CID and/or multihash.
 * e.g CAR CID & CommP CID
 */
export const equals = capability({
  can: 'assert/equals',
  with: URI.match({ protocol: 'did:' }),
  nb: Schema.struct({
    content: linkOrDigest(),
    equals: Schema.link(),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equalLinkOrDigestContent(claimed, delegated)) ||
    and(equal(claimed.nb.equals, delegated.nb.equals, 'equals')) ||
    ok({}),
})
