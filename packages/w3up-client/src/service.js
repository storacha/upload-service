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
    id:
      options.id ??
      (options.url
        ? DID.parse(`did:web:${options.url.hostname}`)
        : accessServicePrincipal),
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
    id:
      options.id ??
      (options.url
        ? DID.parse(`did:web:${options.url.hostname}`)
        : uploadServicePrincipal),
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
    id:
      options.id ??
      (options.url
        ? DID.parse(`did:web:${options.url.hostname}`)
        : filecoinServicePrincipal),
    codec: CAR.outbound,
    channel: HTTP.open({
      url: options.url ?? filecoinServiceURL,
      method: 'POST',
      headers: { ...defaultHeaders, ...options.headers },
    }),
  })

export const gatewayServiceURL = new URL('https://w3s.link')
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
    id:
      id ??
      (url ? DID.parse(`did:web:${url.hostname}`) : gatewayServicePrincipal),
    codec: CAR.outbound,
    channel: HTTP.open({
      url: url ?? gatewayServiceURL,
      method: 'POST',
    }),
  })

/** @type {(options: Partial<Record<'access'|'upload'|'filecoin'|'gateway', import('./types.js').ConnectionView<any> | { id?: import('./types.js').Principal<any>, url: URL }>>) => import('./types.js').ServiceConf} */
export const serviceConf = (options = {}) => ({
  access:
    options.access && 'channel' in options.access
      ? options.access
      : accessServiceConnection(options.access),
  upload:
    options.upload && 'channel' in options.upload
      ? options.upload
      : uploadServiceConnection(options.upload),
  filecoin:
    options.filecoin && 'channel' in options.filecoin
      ? options.filecoin
      : filecoinServiceConnection(options.filecoin),
  gateway:
    options.gateway && 'channel' in options.gateway
      ? options.gateway
      : gatewayServiceConnection(options.gateway),
})

export { receiptsEndpoint }
