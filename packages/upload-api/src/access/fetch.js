import * as Server from '@ucanto/server'
import * as validator from '@ucanto/validator'
import * as Access from '@storacha/capabilities/access'
import * as API from '../types.js'
import * as delegationsResponse from '../utils/delegations-response.js'

/**
 * @param {API.AccessFetchContext} ctx
 */
export const provide = (ctx) =>
  Server.provide(Access.fetch, (input) => fetch(input, ctx))

/**
 * @param {API.Input<Access.fetch>} input
 * @param {API.AccessFetchContext} ctx
 * @returns {Promise<API.Result<API.AccessFetchSuccess, API.AccessFetchFailure>>}
 */
export const fetch = async ({ capability }, { delegationsStorage }) => {
  const did = capability.with

  if (!validator.DID.match({ method: 'plc' }).is(did)) {
    return {
      error: {
        name: 'InvalidDID',
        message: 'access/fetch only supports did:plc identifiers',
      },
    }
  }

  // Public operation - no authentication required
  // TODO(fforbeck): add rate limiting
  const result = await delegationsStorage.find({ audience: did })

  if (result.error) {
    return {
      error: {
        name: 'AccessFetchFailure',
        message: 'error finding delegations',
        cause: result.error,
      },
    }
  }

  return {
    ok: {
      delegations: delegationsResponse.encode(result.ok),
    },
  }
} 