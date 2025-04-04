import { isBrowser, isNode, isBun, isDeno, isElectron } from 'environment'

import * as client from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import { receiptsEndpoint } from '@storacha/upload-client'

export const accessServiceURL = new URL('https://up.storacha.network')
export const accessServicePrincipal = DID.parse('did:web:up.storacha.network')

const envName = isBrowser ? 'Browser' : isNode ? 'Node' : isBun ? 'Bun' : isDeno ? 'Deno' : isElectron ? 'Electron' : 'Unknown'
export const defaultHeaders = {
  'X-Client': `Storacha/1 (js; ${envName})`,
}

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
      url: options.url ?? accessServiceURL,
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

/** @type {() => import('./types.js').ServiceConf} */
export const serviceConf = () => ({
  access: accessServiceConnection(),
  upload: uploadServiceConnection(),
  filecoin: filecoinServiceConnection(),
})

export { receiptsEndpoint }
