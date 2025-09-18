/**
 * Space Replica Capabilities.
 *
 * An extension to the space protocol that allows agents to manage and query
 * replica information for blobs stored in a space.
 *
 * These can be imported directly with:
 *
 * ```js
 * import * as SpaceReplica from '@storacha/capabilities/space/replica'
 * ```
 *
 * @module
 */
import { capability, Schema, ok, fail } from '@ucanto/validator'
import { equals } from 'multiformats/bytes'
import { equalWith, SpaceDID } from '../../utils.js'

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * derive any `space/replica/` prefixed capability for the space identified
 * by DID in the `with` field.
 */
export const replica = capability({
  can: 'space/replica/*',
  /** DID of the space where replica information is stored. */
  with: SpaceDID,
  derives: equalWith,
})

/**
 * The `space/replica/list` capability allows an agent to list current replicas
 * for a given blob in the space identified by DID in the `with` field.
 */
export const list = capability({
  can: 'space/replica/list',
  /** DID of the space where replica information is stored. */
  with: SpaceDID,
  nb: Schema.struct({
    /** Blob to list replicas for. */
    blob: Schema.bytes(),
    /**
     * A pointer that can be moved back and forth on the list.
     * It can be used to paginate a list for instance.
     */
    cursor: Schema.string().optional(),
    /**
     * Maximum number of items per page.
     */
    size: Schema.integer().optional(),
  }),
  derives: (claimed, delegated) => {
    if (claimed.with !== delegated.with) {
      return fail(
        `Expected 'with: "${delegated.with}"' instead got '${claimed.with}'`
      )
    } else if (
      delegated.nb.blob &&
      !equals(delegated.nb.blob, claimed.nb.blob)
    ) {
      return fail(
        `Blob digest ${claimed.nb.blob ? `${claimed.nb.blob}` : ''} violates imposed ${delegated.nb.blob} constraint.`
      )
    }
    return ok({})
  },
})

// ⚠️ We export imports here so they are not omitted in generated typedefs
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Schema }
