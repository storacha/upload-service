import * as API from '@storacha/router/types'
import { ok, error, Failure } from '@ucanto/core'
import { Invocation, Delegation } from '@ucanto/core'
import { base58btc } from 'multiformats/bases/base58'

/**
 * @typedef {{
 *   id: import('@ucanto/interface').Signer,
 *   connection: import('@ucanto/interface').ConnectionView<API.StorageService>
 * }} StorageProvider
 */

/** @type {Map<string, import('@ucanto/interface').Principal>} */
const stickySelect = new Map()

/**
 * @param {import('@ucanto/interface').Signer} serviceID
 * @param {Array<StorageProvider>} storageProviders
 */
export const create = (serviceID, storageProviders) =>
  /** @type {API.RoutingService} */
  ({
    selectStorageProvider: async (digest) => {
      // ensure we pick the same provider for a given digest within a test
      const key = base58btc.encode(digest.bytes)
      let provider = stickySelect.get(key)
      if (
        provider &&
        !storageProviders.some((p) => p.id.did() === provider?.did())
      ) {
        provider = undefined
      }
      if (!provider) {
        provider =
          storageProviders[getRandomInt(storageProviders.length - 1)].id
        stickySelect.set(key, provider)
      }
      return ok(provider)
    },
    selectReplicationProviders: async (
      primary,
      count,
      digest,
      size,
      options
    ) => {
      const exclusions = [primary, ...(options?.exclude ?? [])].map((p) =>
        p.did()
      )
      const filteredProviders = storageProviders
        .map((sp) => sp.id)
        .filter((id) => !exclusions.includes(id.did()))

      if (filteredProviders.length < count) {
        return error(
          /** @type {API.CandidateUnavailable} */ ({
            name: 'CandidateUnavailable',
            message: `Wanted ${count} but only ${filteredProviders.length} are available`,
          })
        )
      }

      /** @type {import('@ucanto/interface').Principal[]} */
      const selectedProviders = []
      for (let i = 0; i < count; i++) {
        const index = getRandomInt(filteredProviders.length - 1)
        selectedProviders.push(filteredProviders[index])
        filteredProviders.splice(index, 1)
      }
      return ok(selectedProviders)
    },
    configureInvocation: async (provider, capability, options) => {
      const prov = storageProviders.find((p) => p.id.did() === provider.did())
      if (!prov) {
        return error(
          new ProofUnavailableError(`unknown provider: ${provider.did()}`)
        )
      }

      const proof = await Delegation.delegate({
        issuer: prov.id,
        audience: serviceID,
        capabilities: [capability],
        expiration: Infinity,
      })

      const invocation = Invocation.invoke({
        ...options,
        issuer: serviceID,
        audience: provider,
        capability,
        proofs: [proof],
      })
      return ok({ invocation, connection: prov.connection })
    },
  })

/** @param {number} max */
const getRandomInt = (max) => Math.floor(Math.random() * max)

export class ProofUnavailableError extends Failure {
  static name = 'ProofUnavailable'

  get name() {
    return ProofUnavailableError.name
  }

  /** @param {string} [reason] */
  constructor(reason) {
    super()
    this.reason = reason
  }

  describe() {
    return this.reason ?? 'proof unavailable'
  }
}
