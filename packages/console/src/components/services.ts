import type { Service, UnknownLink } from '@w3ui/react'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'


export const serviceURL = new URL(
  // 'https://staging.up.web3.storage'
  process.env.NEXT_PUBLIC_W3UP_SERVICE_URL ?? 'https://up.web3.storage'
)

export const receiptsURL = new URL(
  // 'https://staging.up.web3.storage/receipt/'
  process.env.NEXT_PUBLIC_W3UP_RECEIPTS_URL ?? 'https://up.web3.storage/receipt/'
)

export const servicePrincipal = DID.parse(
  // 'did:web:staging.web3.storage'
  process.env.NEXT_PUBLIC_W3UP_SERVICE_DID ?? 'did:web:web3.storage'
)

export const ipfsGatewayURL = (rootCID: UnknownLink | string) => new URL(
  // 'https://%ROOT_CID%.ipfs.w3s.link' or 'https://%ROOT_CID%.ipfs-staging.w3s.link'
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL?.replace('%ROOT_CID%', rootCID.toString()) ?? `https://${rootCID}.ipfs.w3s.link`
).toString()

export const serviceConnection = connect<Service>({
  id: servicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open<any>({
    url: serviceURL,
    method: 'POST',
  }),
})

/**
 * Using freeway.dag.haus/freeway-staging.dag.haus as the gateway host directly without going through w3s.link
 * to avoid the need to avoid access fetch error in production due to the w3s.link CORS policy:
 * - Redirect is not allowed for a preflight request.
 */
export const gatewayHost = process.env.NEXT_PUBLIC_W3UP_GATEWAY_HOST ?? 'https://freeway.dag.haus'
