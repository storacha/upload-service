import * as API from './types.js'
import * as Server from '@ucanto/server'
import * as Space from '@storacha/capabilities/space'
import { ensureRateLimitAbove } from './utils/rate-limits.js'

/**
 * @param {{capability: {with: API.SpaceDID, nb?: {size: number }}}} input
 * @param {API.SpaceServiceContext} context
 * @returns {Promise<API.Result<{ providers: API.ProviderDID[] }, API.AllocationError>>}
 */
export const allocate = async ({ capability }, context) => {
  const { with: space } = capability
  const rateLimitResult = await ensureRateLimitAbove(
    context.rateLimitsStorage,
    [space],
    0
  )
  if (rateLimitResult.error) {
    return {
      error: {
        name: 'InsufficientStorage',
        message: `${space} is blocked`,
      },
    }
  }
  const result = await context.provisionsStorage.getStorageProviders(space)
  if (result.error) {
    return result
  }
  if (!result.ok.length) {
    return Server.error(
      /** @type {API.AllocationError} */
      ({
        name: 'InsufficientStorage',
        message: `${space} has no storage provider`,
      })
    )
  }

  if (capability.nb?.size) {
    /** @type {API.ProviderDID[]} */
    const providersWithSpace = []
    for (const provider of result.ok) {
      const result = await context.provisionsStorage.getConsumer(
        provider,
        space
      )
      if (result.error) {
        continue
      }
      const consumer = result.ok
      if (
        consumer.allocated + capability.nb.size <= consumer.limit ||
        consumer.limit === 0
      ) {
        providersWithSpace.push(provider)
      }
    }

    if (providersWithSpace.length === 0) {
      return Server.error(
        /** @type {API.AllocationError} */
        ({
          name: 'InsufficientStorage',
          message: `${space} has no storage provider with enough space`,
        })
      )
    }
    return Server.ok({ providers: providersWithSpace })
  }

  return Server.ok({ providers: result.ok })
}

/**
 *
 * @param {API.SpaceServiceContext} context
 */
export const provide = (context) =>
  Server.provide(Space.allocate, (input) => allocate(input, context))
