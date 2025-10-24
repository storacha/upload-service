/**
 * Space Content Capabilities.
 *
 * These can be imported directly with:
 * ```js
 * import * as Content from '@storacha/capabilities/space/content'
 * ```
 *
 * @module
 */
import { capability, Schema, fail, ok } from '@ucanto/validator'
import { base58btc } from 'multiformats/bases/base58'
import { equals } from 'multiformats/bytes'
import { equalWith, SpaceDID, and } from '../utils.js'

/** @import * as API from '@ucanto/interface' */

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * derived any `space/blob/` prefixed capability for the space identified
 * by DID in the `with` field.
 */
export const content = capability({
  can: 'space/content/*',
  /** DID of the space where Blob is stored. */
  with: SpaceDID,
  derives: equalWith,
})

/**
 * Capability allowing blob content to be retrieved (typically as a DAG) via
 * byte range requests.
 */
export const retrieve = capability({
  can: 'space/content/retrieve',
  /** DID of the space where Blob is stored. */
  with: SpaceDID,
  nb: Schema.struct({
    blob: Schema.struct({
      /** A multihash digest of the blob to retrieve bytes from. */
      digest: Schema.bytes(),
    }),
    /** Byte range to extract. Start and end byte. Both inclusive. */
    range: Schema.tuple([
      Schema.integer().greaterThan(-1),
      Schema.integer().greaterThan(-1),
    ]),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equalDigest(claimed, delegated)) ||
    and(equalByteRange(claimed, delegated)) ||
    ok({}),
})

/**
 * @template {API.ParsedCapability<API.Ability, API.URI, { blob: { digest: Uint8Array } }>} T
 * @param {T} claimed
 * @param {T} delegated
 * @returns {API.Result<{}, API.Failure>}
 */
export const equalDigest = (claimed, delegated) => {
  if (
    delegated.nb.blob?.digest &&
    (!claimed.nb.blob?.digest ||
      !equals(delegated.nb.blob.digest, claimed.nb.blob.digest))
  ) {
    return fail(
      `digest ${
        claimed.nb.blob?.digest
          ? `${base58btc.encode(claimed.nb.blob.digest)}`
          : ''
      } violates imposed ${base58btc.encode(
        delegated.nb.blob.digest
      )} constraint.`
    )
  }
  return ok({})
}

/**
 * @template {API.ParsedCapability<API.Ability, API.URI, { range: number[] }>} T
 * @param {T} claimed
 * @param {T} delegated
 * @returns {API.Result<{}, API.Failure>}
 */
export const equalByteRange = (claimed, delegated) => {
  if (delegated.nb.range) {
    if (!claimed.nb.range) {
      return fail(
        `byte range violates imposed [${delegated.nb.range}] constraint.`
      )
    }
    if (
      claimed.nb.range[0] < delegated.nb.range[0] ||
      claimed.nb.range[1] > delegated.nb.range[1]
    ) {
      return fail(
        `byte range [${claimed.nb.range}] violates imposed [${delegated.nb.range}] constraint.`
      )
    }
  }
  return ok({})
}

// ⚠️ We export imports here so they are not omitted in generated typedefs
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Schema }
