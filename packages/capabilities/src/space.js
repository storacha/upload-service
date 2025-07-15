/**
 * Space Capabilities
 *
 * These can be imported directly with:
 * ```js
 * import * as Space from '@storacha/capabilities/space'
 * ```
 *
 * @module
 */

import * as Store from './store.js'
import { capability, Schema, ok, fail } from '@ucanto/validator'
import { SpaceDID, equalWith } from './utils.js'
import * as Upload from './upload.js'
export { top } from './top.js'

// Need this to workaround TS bug
// @see https://github.com/microsoft/TypeScript/issues/51548
export { Store }

export const space = capability({
  can: 'space/*',
  with: SpaceDID,
  derives: equalWith,
})

/**
 * `space/info` can be derived from any of the `store/*`
 * capability that has matching `with`. This allows store service
 * to identify account based on any user request.
 */
export const info = Store.add
  .or(Store.list)
  .or(Store.remove)
  .or(Upload.add)
  .or(Upload.list)
  .or(Upload.remove)
  .derive({
    to: capability({
      can: 'space/info',
      with: SpaceDID,
    }),
    derives: equalWith,
  })

export const allocate = capability({
  can: 'space/allocate',
  with: SpaceDID,
  nb: Schema.struct({
    size: Schema.integer(),
  }),
  derives: (child, parent) => {
    const result = equalWith(child, parent)
    if (result.ok) {
      return child.nb.size <= parent.nb.size
        ? ok({})
        : fail(
            `Claimed size ${child.nb.size} escalates delegated size ${parent.nb.size}`
          )
    } else {
      return result
    }
  },
})

/**
 * The capability grants permission for all content serve operations that fall under the "space/content/serve" namespace.
 * It can be derived from any of the `space/*` capability that has matching `with`.
 */

export const contentServe = capability({
  can: 'space/content/serve/*',
  with: SpaceDID,
  derives: equalWith,
})

/**
 * Capability can be invoked by an agent to record egress data for a given resource.
 * It can be derived from any of the `space/content/serve/*` capability that has matching `with`.
 */
export const egressRecord = capability({
  can: 'space/content/serve/egress/record',
  with: SpaceDID,
  nb: Schema.struct({
    /** CID of the resource that was served. */
    resource: Schema.link(),
    /** Amount of bytes served. */
    bytes: Schema.integer().greaterThan(0),
    /** Timestamp of the event in milliseconds after Unix epoch. */
    servedAt: Schema.integer().greaterThan(-1),
  }),
  derives: equalWith,
})

/**
 * The capability grants permission to decrypt a given resource.
 * It can be derived from `space/content/decrypt` capability that has matching `with` and `nb.resource`.
 */
export const decrypt = capability({
  can: 'space/content/decrypt',
  with: SpaceDID,
  nb: Schema.struct({
    resource: Schema.link(),
  }),
  derives: (child, parent) => {
    if (child.with !== parent.with) {
      return fail(
        `Can not derive ${child.can} with ${child.with} from ${parent.with}`
      )
    }
    if (child.nb.resource.toString() !== parent.nb.resource.toString()) {
      return fail(
        `Can not derive ${child.can} resource ${child.nb.resource} from ${parent.nb.resource}`
      )
    }
    return ok({})
  },
})

/**
 * "Setup encryption for a Space using asymmetric keys in KMS."
 *
 * A Principal who may `space/encryption/setup` is permitted to initialize
 * encryption for a Space. This generates an RSA key pair in Google KMS
 * for the Space and returns the public key that clients can use to encrypt
 * per-file symmetric keys.
 *
 * This operation is idempotent - invoking it the first time generates the
 * asymmetric key for the space, but future invocations just return the
 * existing public key.
 *
 * The Space must be provisioned for a paid plan to use encryption.
 */
export const EncryptionSetup = capability({
  can: 'space/encryption/setup',
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * The location of the KMS key to use for encryption. If not provided, the Storacha Key Manager will use the default location.
     */
    location: Schema.string().optional(),
    /**
     * The keyring of the KMS key to use for encryption. If not provided, the Storacha Key Manager will use the default keyring.
     */
    keyring: Schema.string().optional(),
  }),
  derives: (child, parent) => {
    if (child.with !== parent.with) {
      return fail(
        `Can not derive ${child.can} with ${child.with} from ${parent.with}`
      )
    }
    if (child.nb.location !== parent.nb.location) {
      return fail(
        `Can not derive ${child.can} location ${child.nb.location} from ${parent.nb.location}`
      )
    }
    if (child.nb.keyring !== parent.nb.keyring) {
      return fail(
        `Can not derive ${child.can} keyring ${child.nb.keyring} from ${parent.nb.keyring}`
      )
    }
    return ok({})
  },
})

/**
 * "Decrypt symmetric keys for encrypted content owned by the subject Space."
 *
 * A Principal who may `space/encryption/key/decrypt` is permitted to decrypt
 * the symmetric keys for any encrypted content owned by the Space. This capability
 * is used by the gateway to validate that a client has permission to access encrypted
 * content and receive the decrypted Data Encryption Keys (DEKs).
 *
 * The gateway will validate this capability against UCAN delegations before
 * providing decrypted Data Encryption Keys (DEKs) to authorized clients.
 */
export const EncryptionKeyDecrypt = capability({
  can: 'space/encryption/key/decrypt',
  with: SpaceDID,
  nb: Schema.struct({
    /**
     * The encrypted symmetric key to be decrypted
     */
    key: Schema.bytes(),
  }),
  derives: (child, parent) => {
    if (child.with !== parent.with) {
      return fail(
        `Can not derive ${child.can} with ${child.with} from ${parent.with}`
      )
    }
    if (child.nb.key !== parent.nb.key) {
      return fail(
        `Can not derive ${child.can} key ${child.nb.key} from ${parent.nb.key}`
      )
    }
    return ok({})
  },
})
