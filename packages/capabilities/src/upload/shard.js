/**
 * Upload Shard Capabilities
 *
 * These can be imported directly with:
 * ```js
 * import * as UploadShard from '@storacha/capabilities/upload/shard'
 * ```
 *
 * @module
 */
import { capability, Link, Schema, ok } from '@ucanto/validator'
import { equalWith, and, equal, SpaceDID, checkLink } from '../utils.js'

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * derive any `upload/shard/` prefixed capability for the space identified by
 * the DID in the `with` field.
 */
export const shard = capability({
  can: 'upload/shard/*',
  /** DID of the space where upload is added. */
  with: SpaceDID,
  derives: equalWith,
})

/**
 * Capability can be invoked to request a list of shards for an upload in the
 * space identified by the `with` field.
 */
export const list = capability({
  can: 'upload/shard/list',
  with: SpaceDID,
  nb: Schema.struct({
    /** Root CID identifying the upload to list shards for. */
    root: Schema.link(),
    /** Opaque pointer to a position in the list, used for pagination. */
    cursor: Schema.string().optional(),
    /** Maximum number of items to return. */
    size: Schema.integer().optional(),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(checkLink(claimed.nb.root, delegated.nb.root, 'root')) ||
    and(equal(claimed.nb.cursor, delegated.nb.cursor, 'cursor')) ||
    and(equal(claimed.nb.size, delegated.nb.size, 'size')) ||
    ok({}),
})

// ⚠️ We export imports here so they are not omitted in generated typedefs
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Link, Schema }
