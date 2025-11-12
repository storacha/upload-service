import * as API from '@storacha/router/types'
import * as PDPCapabilities from '@storacha/capabilities/pdp'
import * as BlobCapabilities from '@storacha/capabilities/blob'
import * as BlobReplicaCapabilities from '@storacha/capabilities/blob/replica'
import { base58btc } from 'multiformats/bases/base58'
import * as Digest from 'multiformats/hashes/digest'
import { ok, error } from '@ucanto/core'
import { ed25519 } from '@ucanto/principal'
import { CAR } from '@ucanto/transport'
import * as Server from '@ucanto/server'
import { connect } from '@ucanto/client'

/**
 * @import { PDPInfoSuccess } from '@storacha/capabilities/types'
 * @typedef {{
 *   set(digest: import('multiformats').MultihashDigest, info: PDPInfoSuccess): void
 *   has: (digest: import('multiformats').MultihashDigest) => Promise<boolean>
 *   getPDPInfo: (digest: import('multiformats').MultihashDigest) => Promise<PDPInfoSuccess | undefined>
 * }} PDPStore
 */

/**
 * Creates a mock storage service that implements the StorageService interface
 * from @storacha/router/types. Only pdp.info is implemented; all other handlers
 * return errors.
 *
 * @param {{
 *   id: import('@ucanto/interface').Signer
 *   pdpStore: PDPStore
 * }} config
 * @returns {API.StorageService}
 */
const createService = ({ id, pdpStore }) => ({
  pdp: {
    info: Server.provideAdvanced({
      capability: PDPCapabilities.info,
      handler: async ({ capability }) => {
        const digest = Digest.decode(capability.nb.blob)
        const hasBlob = await pdpStore.has(digest)
        if (!hasBlob) {
          return error({
            name: 'BlobNotFound',
            message: `blob with digest ${base58btc.encode(
              digest.bytes
            )} not found`,
          })
        }

        const pdpInfo = await pdpStore.getPDPInfo(digest)
        console.log('PDP Info retrieved:', pdpInfo)
        if (!pdpInfo) {
          return error({
            name: 'PDPInfoNotAvailable',
            message: `PDP info for blob with digest ${base58btc.encode(
              digest.bytes
            )} not available`,
          })
        }

        return ok(pdpInfo)
      },
    }),
  },
  blob: {
    allocate: Server.provideAdvanced({
      capability: BlobCapabilities.allocate,
      handler: async () => {
        return error({
          name: 'NotImplemented',
          message: 'blob/allocate not implemented in test storage node',
        })
      },
    }),
    accept: Server.provideAdvanced({
      capability: BlobCapabilities.accept,
      handler: async () => {
        return error({
          name: 'NotImplemented',
          message: 'blob/accept not implemented in test storage node',
        })
      },
    }),
    replica: {
      allocate: Server.provideAdvanced({
        capability: BlobReplicaCapabilities.allocate,
        handler: async () => {
          return error({
            name: 'NotImplemented',
            message:
              'blob/replica/allocate not implemented in test storage node',
          })
        },
      }),
    },
  },
})

/**
 * A test storage node that implements the StorageService interface.
 * Only pdp.info is functional; other capabilities return errors.
 */
export class StorageNode {
  /**
   * @param {{
   *   pdpStore?: PDPStore
   * } & import('@ucanto/interface').PrincipalResolver} config
   */
  static async activate({ pdpStore, resolveDIDKey } = {}) {
    const id = await ed25519.generate()

    // Default PDP store with no data
    const store = pdpStore ?? {
      set: () => {},
      has: async () => false,
      getPDPInfo: async () => undefined,
    }

    const server = Server.create({
      id,
      codec: CAR.inbound,
      service: createService({
        id,
        pdpStore: store,
      }),
      resolveDIDKey,
      validateAuthorization: () => ({ ok: {} }),
    })

    const connection = connect({ id, codec: CAR.outbound, channel: server })

    return new StorageNode({ id, connection, pdpStore: store })
  }

  /**
   * @param {{
   *   id: import('@ucanto/interface').Signer
   *   connection: import('@ucanto/interface').ConnectionView<API.StorageService>
   *   pdpStore: PDPStore
   * }} config
   */
  constructor({ id, connection, pdpStore }) {
    this.id = id
    this.connection = connection
    this.pdpStore = pdpStore
  }

  /**
   * Adds PDP info for a blob digest
   *
   * @param {import('multiformats').MultihashDigest} digest
   * @param {PDPInfoSuccess} info
   */
  async addPDPInfo(digest, info) {
    this.pdpStore.set(digest, info)
  }
}

/**
 * Creates a simple in-memory PDP store for testing
 *
 * @returns {PDPStore}
 */
export function createPDPStore() {
  /** @type {Map<string, PDPInfoSuccess>} */
  const store = new Map()

  return {
    set: (digest, info) => {
      const key = base58btc.encode(digest.bytes)
      store.set(key, info)
    },
    /**
     * @param {import('multiformats').MultihashDigest} digest
     */
    has: async (digest) => {
      const key = base58btc.encode(digest.bytes)
      return store.has(key)
    },
    /**
     * @param {import('multiformats').MultihashDigest} digest
     */
    getPDPInfo: async (digest) => {
      const key = base58btc.encode(digest.bytes)
      return store.get(key)
    },
  }
}
