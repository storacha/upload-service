import * as client from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'
import { gatewayServiceConnection } from '@storacha/client/service'

const storachaServiceURL = 'https://up.web3.storage'
const storachaPrincipalDID = 'did:web:web3.storage'

//TODO: Instead of declaring the service URL and principal here,
// import them from the w3up-client/service package.
// It needs to be done after the repo unification tasks is completed
// Because the DID Web is did:web:up.storacha.network
export const accessServiceURL = new URL(storachaServiceURL)
export const accessServicePrincipal = DID.parse(storachaPrincipalDID)

export const accessServiceConnection = client.connect({
  id: accessServicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open({ url: accessServiceURL, method: 'POST' }),
})

export const uploadServiceURL = new URL(storachaServiceURL)
export const uploadServicePrincipal = DID.parse(storachaPrincipalDID)

export const uploadServiceConnection = client.connect({
  id: uploadServicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open({ url: accessServiceURL, method: 'POST' }),
})

export const filecoinServiceURL = new URL(storachaServiceURL)
export const filecoinServicePrincipal = DID.parse(storachaPrincipalDID)

export const filecoinServiceConnection = client.connect({
  id: filecoinServicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open({ url: accessServiceURL, method: 'POST' }),
})

/** @type {import('@storacha/client/types').ServiceConf} */
export const serviceConf = {
  access: accessServiceConnection,
  upload: uploadServiceConnection,
  filecoin: filecoinServiceConnection,
  gateway: gatewayServiceConnection(),
}

export const receiptsEndpoint = new URL(`${storachaServiceURL}/receipt/`)
