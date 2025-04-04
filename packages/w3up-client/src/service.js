import * as client from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import { receiptsEndpoint } from '@storacha/upload-client'

export const accessServiceURL = new URL('https://up.storacha.network')
export const accessServicePrincipal = DID.parse('did:web:up.storacha.network')

export const accessServiceConnection = client.connect({
  id: accessServicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open({ url: accessServiceURL, method: 'POST' }),
})

export const uploadServiceURL = new URL('https://up.storacha.network')
export const uploadServicePrincipal = DID.parse('did:web:up.storacha.network')

export const uploadServiceConnection = client.connect({
  id: uploadServicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open({ url: accessServiceURL, method: 'POST' }),
})

export const filecoinServiceURL = new URL('https://up.storacha.network')
export const filecoinServicePrincipal = DID.parse('did:web:up.storacha.network')

export const filecoinServiceConnection = client.connect({
  id: filecoinServicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open({ url: accessServiceURL, method: 'POST' }),
})

export const gatewayServiceURL = new URL('https://storacha.link')
export const gatewayServicePrincipal = DID.parse('did:web:storacha.link')

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
      method: 'POST'
    }),
  })

/** @type {import('./types.js').ServiceConf} */
export const serviceConf = {
  access: accessServiceConnection,
  upload: uploadServiceConnection,
  filecoin: filecoinServiceConnection,
  gateway: gatewayServiceConnection(),
}

export { receiptsEndpoint }
