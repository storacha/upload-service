import type { Service, UnknownLink } from '@storacha/ui-react'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'


export const serviceURL = new URL(
  // 'https://staging.up.storacha.network'
  process.env.NEXT_PUBLIC_W3UP_SERVICE_URL ?? 'https://up.storacha.network'
)

export const receiptsURL = new URL(
  // 'https://staging.up.storacha.network/receipt/'
  process.env.NEXT_PUBLIC_W3UP_RECEIPTS_URL ?? 'https://up.storacha.network/receipt/'
)

export const servicePrincipal = DID.parse(
  // 'did:web:staging.up.storacha.network'
  process.env.NEXT_PUBLIC_W3UP_SERVICE_DID ?? 'did:web:up.storacha.network'
)

export const ipfsGatewayURL = (rootCID: UnknownLink | string) => new URL(
  // 'https://%ROOT_CID%.ipfs.w3s.link' or 'https://%ROOT_CID%.ipfs-staging.w3s.link'
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL?.replace('%ROOT_CID%', rootCID.toString()) ?? `https://${rootCID}.ipfs.w3s.link`
)

export const ipfsGatewayURLStr = (rootCID: UnknownLink | string) => ipfsGatewayURL(rootCID).toString()

export const serviceConnection = connect<Service>({
  id: servicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open<any>({
    url: serviceURL,
    method: 'POST',
  }),
})

export const gatewayHost = process.env.NEXT_PUBLIC_W3UP_GATEWAY_HOST ?? 'https://gateway.storacha.network'
