import { ucanRevokeProvider } from './ucan/revoke.js'
import { ucanConcludeProvider } from './ucan/conclude.js'
import * as API from './types.js'

/**
 * @param {API.UcanServiceContext & API.LegacyConcludeServiceContext} context
 */
export const createService = (context) => {
  return {
    conclude: ucanConcludeProvider(context),
    revoke: ucanRevokeProvider(context),
  }
}
