import { isBrowser, isNode, isBun, isDeno, isElectron } from 'environment'

import * as client from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import { receiptsEndpoint } from '@storacha/upload-client'

export const accessServiceURL = new URL('https://up.storacha.network')
export const accessServicePrincipal = DID.parse('did:web:up.storacha.network')

/* c8 ignore start */
const envName = isBrowser
  ? 'Browser'
  : isNode
  ? 'Node'
  : isBun
  ? 'Bun'
  : isDeno
  ? 'Deno'
  : isElectron
  ? 'Electron'
  : 'Unknown'
export const defaultHeaders = {
  'X-Client': `Storacha/1 (js; ${envName})`,
}
/* c8 ignore end */

/**
 * @param {object} [options]
 * @param {Record<string, string>} [options.headers]
 * @param {import('./types.js').Principal} [options.id]
 * @param {URL} [options.url]
 */
export const accessServiceConnection = (options = {}) =>
  client.connect({
    id: options.id ?? accessServicePrincipal,
    codec: CAR.outbound,
    channel: HTTP.open({
      url: options.url ?? accessServiceURL,
      method: 'POST',
      headers: { ...defaultHeaders, ...options.headers },
    }),
  })

export const uploadServiceURL = new URL('https://up.storacha.network')
export const uploadServicePrincipal = DID.parse('did:web:up.storacha.network')

/**
 * @param {object} [options]
 * @param {Record<string, string>} [options.headers]
 * @param {import('./types.js').Principal} [options.id]
 * @param {URL} [options.url]
 */
export const uploadServiceConnection = (options = {}) =>
  client.connect({
    id: options.id ?? uploadServicePrincipal,
    codec: CAR.outbound,
    channel: HTTP.open({
      url: options.url ?? uploadServiceURL,
      method: 'POST',
      headers: { ...defaultHeaders, ...options.headers },
    }),
  })

export const filecoinServiceURL = new URL('https://up.storacha.network')
export const filecoinServicePrincipal = DID.parse('did:web:up.storacha.network')

/**
 * @param {object} [options]
 * @param {Record<string, string>} [options.headers]
 * @param {import('./types.js').Principal} [options.id]
 * @param {URL} [options.url]
 */
export const filecoinServiceConnection = (options = {}) =>
  client.connect({
    id: options.id ?? filecoinServicePrincipal,
    codec: CAR.outbound,
    channel: HTTP.open({
      url: options.url ?? filecoinServiceURL,
      method: 'POST',
      headers: { ...defaultHeaders, ...options.headers },
    }),
  })

// Note: we use a UCAN service domain that is different to the public access
// domain so that if public access is blocked it does not effect authorization
// invocations.
export const gatewayServiceURL = new URL('https://gateway.storacha.network')
export const gatewayServicePrincipal = DID.parse('did:web:w3s.link')

/**
 * Create a connection to a gateway service.
 *
 * @param {object} [options]
 * @param {import('./types.js').Principal} [options.id]
 * @param {URL} [options.url]
 */
export const gatewayServiceConnection = ({ id, url } = {}) =>
  client.connect({
    id: id ?? gatewayServicePrincipal,
    codec: CAR.outbound,
    channel: HTTP.open({
      url: url ?? gatewayServiceURL,
      method: 'POST',
    }),
  })

/** @type {() => import('./types.js').ServiceConf} */
export const serviceConf = () => ({
  access: accessServiceConnection(),
  upload: uploadServiceConnection(),
  filecoin: filecoinServiceConnection(),
  gateway: gatewayServiceConnection(),
})

export { receiptsEndpoint }
