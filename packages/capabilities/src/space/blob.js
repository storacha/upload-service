/**
 * Blob Capabilities.
 *
 * Blob is a fixed size byte array addressed by the multihash.
 * Usually blobs are used to represent set of IPLD blocks at different byte ranges.
 *
 * These can be imported directly with:
 * ```js
 * import * as Blob from '@storacha/capabilities/space/blob'
 * ```
 *
 * @module
 */
import { equals as SpaceBlobCapabilities } from 'uint8arrays/equals'
import { capability, Schema, fail, ok } from '@ucanto/validator'
import { equalBlob, equalWith, SpaceDID, and, equal, checkLink } from '../utils.js'

/**
 * Agent capabilities for Blob protocol
 */

/**
 * Capability can only be delegated (but not invoked) allowing audience to
 * derived any `space/blob/` prefixed capability for the (memory) space identified
 * by DID in the `with` field.
 */
export const blob = capability({
  can: 'space/blob/*',
  /**
   * DID of the (memory) space where Blob is intended to
   * be stored.
   */
  with: SpaceDID,
  derives: equalWith,
})

/**
 * Blob description for being ingested by the service.
 */
export const content = Schema.struct({
  /**
   * A multihash digest of the blob payload bytes, uniquely identifying blob.
   */
  digest: Schema.bytes(),
  /**
   * Number of bytes contained by this blob. Service will provision write target
   * for this exact size. Attempt to write a larger Blob file will fail.
   */
  size: Schema.integer(),
})

/**
 * `space/blob/add` capability allows agent to store a Blob into a (memory) space
 * identified by did:key in the `with` field. Agent should compute blob multihash
 * and size and provide it under `nb.blob` field, allowing a service to provision
 * a write location for the agent to PUT desired Blob into.
 */
export const add = capability({
  can: 'space/blob/add',
  /**
   * DID of the (memory) space where Blob is intended to
   * be stored.
   */
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * Blob to be added on the space.
     */
    blob: content,
  }),
  derives: equalBlob,
})

/**
 * Capability can be used to remove the stored Blob from the (memory)
 * space identified by `with` field.
 */
export const remove = capability({
  can: 'space/blob/remove',
  /**
   * DID of the (memory) space where Blob is stored.
   */
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * A multihash digest of the blob payload bytes, uniquely identifying blob.
     */
    digest: Schema.bytes(),
  }),
  derives: (claimed, delegated) => {
    if (claimed.with !== delegated.with) {
      return fail(
        `Expected 'with: "${delegated.with}"' instead got '${claimed.with}'`
      )
    } else if (
      delegated.nb.digest &&
      !SpaceBlobCapabilities(delegated.nb.digest, claimed.nb.digest)
    ) {
      return fail(
        `Link ${
          claimed.nb.digest ? `${claimed.nb.digest}` : ''
        } violates imposed ${delegated.nb.digest} constraint.`
      )
    }
    return ok({})
  },
})

/**
 * Capability can be invoked to request a list of stored Blobs in the
 * (memory) space identified by `with` field.
 */
export const list = capability({
  can: 'space/blob/list',
  /**
   * DID of the (memory) space where Blobs to be listed are stored.
   */
  with: SpaceDID,
  nb: Schema.struct({
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
    }
    return ok({})
  },
})

/**
 * Capability can be used to get the stored Blob from the (memory)
 * space identified by `with` field.
 */
export const get = capability({
  can: 'space/blob/get/0/1',
  /**
   * DID of the (memory) space where Blob is stored.
   */
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * A multihash digest of the blob payload bytes, uniquely identifying blob.
     */
    digest: Schema.bytes(),
  }),
  derives: (claimed, delegated) => {
    if (claimed.with !== delegated.with) {
      return fail(
        `Expected 'with: "${delegated.with}"' instead got '${claimed.with}'`
      )
    } else if (
      delegated.nb.digest &&
      !SpaceBlobCapabilities(delegated.nb.digest, claimed.nb.digest)
    ) {
      return fail(
        `Link ${
          claimed.nb.digest ? `${claimed.nb.digest}` : ''
        } violates imposed ${delegated.nb.digest} constraint.`
      )
    }
    return ok({})
  },
})

/**
 * The `space/blob/replicate` capability allows an agent to replicate a Blob
 * into a space identified by did:key in the `with` field.
 *
 * A replicate capability may only be invoked after a `blob/accept` receipt has
 * been receieved, indicating the source node has successfully received the
 * blob.
 *
 * Each Replicate task MUST target a different node, and they MUST NOT target
 * the original upload target.
 *
 * The Replicate task receipt includes async tasks for `blob/replica/allocate`
 * and `blob/replica/transfer`. Successful completion of the
 * `blob/replica/transfer` task indicates the replication target has transferred
 * and stored the blob. The number of `blob/replica/allocate` and
 * `blob/replica/transfer` tasks corresponds directly to number of replicas
 * requested.
 */
export const replicate = capability({
  can: 'space/blob/replicate',
  /** Space DID. */
  with: Schema.did(),
  nb: Schema.struct({
    /** Blob to replicate. */
    blob: content,
    /**
     * The number of replicas to ensure. e.g. `replicas: 2` will ensure 3 copies
     * of the data exist in the network.
     */
    replicas: Schema.integer().greaterThan(0),
    /** Link to a location commitment indicating where the Blob must be fetched from. */
    site: Schema.link({ version: 1 }),
  }),
  derives: (claimed, delegated) =>
    and(equalWith(claimed, delegated)) ||
    and(equalBlob(claimed, delegated)) ||
    and(equal(claimed.nb.replicas, delegated.nb.replicas, 'replicas')) ||
    and(checkLink(claimed.nb.site, delegated.nb.site, 'site')) ||
    ok({}),
})

// ⚠️ We export imports here so they are not omitted in generated typedefs
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Schema }
