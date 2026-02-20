import * as RouterAPI from '@storacha/router/types'
import { CandidateUnavailableError } from '@storacha/router'
import * as API from '../types.js'

/**
 * Creates a capacity-aware router wrapper that filters providers based on available capacity
 * before delegating to the underlying router.
 *
 * @param {RouterAPI.RoutingService} router - The underlying router
 * @param {API.ProviderCapacityStorage} capacityStorage - Storage for provider capacity
 * @returns {RouterAPI.RoutingService}
 */
export function createCapacityAwareRouter(router, capacityStorage) {
  return {
    /**
     * @param {import('multiformats').MultihashDigest} digest
     * @param {number} size
     * @param {RouterAPI.SelectStorageProviderOptions} [options]
     * @returns {Promise<import('@ucanto/interface').Result<import('@ucanto/interface').Principal, RouterAPI.CandidateUnavailable | import('@ucanto/interface').Failure>>}
     */
    selectStorageProvider: async (digest, size, options) => {
      // First, get a candidate from the underlying router
      // We'll filter based on capacity in a loop if needed
      const exclude = options?.exclude ?? []
      /** @type {import('@ucanto/interface').Principal[]} */
      const attemptedProviders = [...exclude]

      // Try to find a provider with available capacity
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidate = await router.selectStorageProvider(digest, size, {
          exclude: attemptedProviders,
        })

        if (candidate.error) {
          return candidate
        }

        const providerDID = /** @type {API.ProviderDID} */ (candidate.ok.did())

        // Check if this provider has available capacity
        const hasCapacity = await capacityStorage.hasAvailableCapacity(
          providerDID,
          size
        )

        if (hasCapacity.error) {
          // If we can't check capacity, exclude this provider and try again
          attemptedProviders.push(candidate.ok)
          continue
        }

        if (hasCapacity.ok) {
          // Provider has capacity, return it
          return candidate
        }

        // Provider doesn't have capacity, exclude and try again
        attemptedProviders.push(candidate.ok)
      }
    },

    /**
     * @param {import('@ucanto/interface').Principal} primary
     * @param {number} count
     * @param {import('multiformats').MultihashDigest} digest
     * @param {number} size
     * @param {RouterAPI.SelectReplicationProvidersOptions} [options]
     * @returns {Promise<import('@ucanto/interface').Result<import('@ucanto/interface').Principal[], RouterAPI.CandidateUnavailable | import('@ucanto/interface').Failure>>}
     */
    selectReplicationProviders: async (
      primary,
      count,
      digest,
      size,
      options
    ) => {
      const exclude = options?.exclude ?? []
      /** @type {import('@ucanto/interface').Principal[]} */
      const attemptedProviders = [primary, ...exclude]
      /** @type {import('@ucanto/interface').Principal[]} */
      const selectedProviders = []

      // Try to find providers with available capacity
      // eslint-disable-next-line no-constant-condition
      while (selectedProviders.length < count) {
        const remaining = count - selectedProviders.length
        const candidate = await router.selectReplicationProviders(
          primary,
          remaining,
          digest,
          size,
          {
            exclude: attemptedProviders,
          }
        )

        if (candidate.error) {
          // If we've already selected some providers, return what we have
          // Otherwise, return the error
          if (selectedProviders.length > 0) {
            return {
              ok: selectedProviders,
            }
          }
          return candidate
        }

        // Filter candidates by capacity
        /** @type {import('@ucanto/interface').Principal[]} */
        const availableProviders = []
        for (const provider of candidate.ok) {
          const providerDID = /** @type {API.ProviderDID} */ (provider.did())
          const hasCapacity = await capacityStorage.hasAvailableCapacity(
            providerDID,
            size
          )

          if (hasCapacity.error) {
            // If we can't check capacity, exclude this provider
            attemptedProviders.push(provider)
            continue
          }

          if (hasCapacity.ok) {
            availableProviders.push(provider)
            selectedProviders.push(provider)
            attemptedProviders.push(provider)
          } else {
            // Provider doesn't have capacity, exclude and try again
            attemptedProviders.push(provider)
          }
        }

        // If we didn't find any available providers in this batch, we might be stuck
        if (availableProviders.length === 0 && selectedProviders.length === 0) {
          // Try one more time with all attempted providers excluded
          const finalAttempt = await router.selectReplicationProviders(
            primary,
            remaining,
            digest,
            size,
            {
              exclude: attemptedProviders,
            }
          )

          if (finalAttempt.error) {
            // If we've already selected some providers, return what we have
            if (selectedProviders.length > 0) {
              return {
                ok: selectedProviders,
              }
            }
            return {
              error: new CandidateUnavailableError(
                `No providers with available capacity. Wanted ${count} but only ${selectedProviders.length} available with capacity.`
              ),
            }
          }

          // Check the final attempt providers
          for (const provider of finalAttempt.ok) {
            const providerDID = /** @type {API.ProviderDID} */ (provider.did())
            const hasCapacity = await capacityStorage.hasAvailableCapacity(
              providerDID,
              size
            )

            if (hasCapacity.ok) {
              selectedProviders.push(provider)
              attemptedProviders.push(provider)
            } else {
              attemptedProviders.push(provider)
            }
          }

          // If we still don't have enough, return what we have or error
          if (selectedProviders.length < count) {
            if (selectedProviders.length > 0) {
              return {
                ok: selectedProviders,
              }
            }
            return {
              error: new CandidateUnavailableError(
                `No providers with available capacity. Wanted ${count} but only ${selectedProviders.length} available with capacity.`
              ),
            }
          }
        }

        // If we have enough providers, return them
        if (selectedProviders.length >= count) {
          return {
            ok: selectedProviders.slice(0, count),
          }
        }
      }

      return {
        ok: selectedProviders,
      }
    },

    configureInvocation: router.configureInvocation.bind(router),
  }
}
