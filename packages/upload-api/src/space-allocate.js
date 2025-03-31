import * as API from './types.js'
import * as Server from '@ucanto/server'
import * as Space from '@storacha/capabilities/space'
import { ensureRateLimitAbove } from './utils/rate-limits.js'

/**
 * @param {{capability: {with: API.SpaceDID}}} input
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

  return Server.ok({ providers: result.ok })
}

/**
 *
 * @param {API.SpaceServiceContext} context
 */
export const provide = (context) =>
  Server.provide(Space.allocate, (input) => allocate(input, context))
