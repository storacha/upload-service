import { EncryptedClient } from './client.js'
import { GATEWAY_URL } from './constants.js'
import { getLit } from './lib.js'

/**
 * 
 * @param {import('./types.js').EncryptedClientOptions} options 
 */
export async function create(options) {
    const litClient = options.litClient ?? await getLit()
    const gatewayURL = options.gatewayURL ?? GATEWAY_URL
    const storachaClient = options.storachaClient

    return new EncryptedClient(storachaClient, litClient, gatewayURL )
}

export { EncryptedClient }