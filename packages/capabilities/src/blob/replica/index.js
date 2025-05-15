/**
 * Blob Replication Capabilities.
 *
 * An extension to the blob protocol that allows nodes within the network to
 * replicate data between each other _after_ a storage node has received an
 * initial upload.
 *
 * These can be imported directly with:
 *
 * ```js
 * import * as BlobReplica from '@storacha/capabilities/blob/replica'
 * ```
 *
 * @module
 * @see https://github.com/storacha/specs/blob/main/w3-replication.md
 */
import { capability, Schema, Link, ok } from '@ucanto/validator'
import { content } from '../../space/blob.js'
import { and, equalWith, equalBlob, checkLink, equal } from '../../utils.js'

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * derive any `blob/replica/` prefixed capability.
 */
export const replica = capability({
  can: 'blob/replica/*',
  /** Storage provider DID. */
  with: Schema.did(),
  derives: equalWith,
})

/**
 * The `blob/replica/allocate` capability that allows an agent to allocate a
 * Blob for replication into a space identified by did:key in the `with` field.
 *
 * The Allocate task receipt includes an async task that will be performed by
 * a storage node: `blob/replica/transfer`. The `blob/replica/transfer` task is
 * completed when the storage node has transferred the blob from its location to
 * the storage node.
 */
export const allocate = capability({
  can: 'blob/replica/allocate',
  /** Storage provider DID. */
  with: Schema.did(),
  nb: Schema.struct({
    /** Blob to allocate. */
    blob: content,
    /** DID of the user space where the allocation takes place. */
    space: Schema.principal({ method: 'key' }),
    /** Link to a location commitment indicating where the Blob must be fetched from. */
    site: Schema.link({ version: 1 }),
    /** Link to the `space/blob/replicate` task that initiated the allocation. */
    cause: Schema.link({ version: 1 }),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equalBlob(claimed, delegated)) ||
    and(equal(claimed.nb.space?.did(), delegated.nb.space?.did(), 'space')) ||
    and(checkLink(claimed.nb.site, delegated.nb.site, 'site')) ||
    and(checkLink(claimed.nb.cause, delegated.nb.cause, 'cause')) ||
    ok({}),
})

/**
 * The `blob/replica/transfer` capability invocation allows an agent to transfer
 * a Blob for replication into a space identified by did:key in the `with` field.
 */
export const transfer = capability({
  can: 'blob/replica/transfer',
  /** Storage provider DID. */
  with: Schema.did(),
  nb: Schema.struct({
    /** Blob to transfer. */
    blob: content,
    /** DID of the user space where the allocation takes place. */
    space: Schema.principal({ method: 'key' }),
    /** Link to a location commitment indicating where the Blob must be fetched from. */
    site: Schema.link({ version: 1 }),
    /** Link to the `blob/replica/allocate` task that initiated the transfer. */
    cause: Schema.link({ version: 1 }),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equalBlob(claimed, delegated)) ||
    and(equal(claimed.nb.space?.did(), delegated.nb.space?.did(), 'space')) ||
    and(checkLink(claimed.nb.site, delegated.nb.site, 'site')) ||
    and(checkLink(claimed.nb.cause, delegated.nb.cause, 'cause')) ||
    ok({}),
})

// ⚠️ We export imports here so they are not omitted in generated typedefs
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Schema, Link }
