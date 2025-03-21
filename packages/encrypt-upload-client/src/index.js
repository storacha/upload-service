import { EncryptedClient } from './client.js'
import { GATEWAY_URL } from './config/constants.js'
import { getLitClient } from './lit.js'

/**
 * 
 * @param {import('./types.js').EncryptedClientOptions} options 
 */
export async function create(options) {
    const litClient = options.litClient ?? await getLitClient()
    const cryptoAdapter = options.cryptoAdapter
    const gatewayURL = options.gatewayURL ?? GATEWAY_URL
    const storachaClient = options.storachaClient

    return new EncryptedClient(storachaClient, cryptoAdapter, litClient, gatewayURL )
}

export { EncryptedClient }