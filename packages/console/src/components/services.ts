import type { Service as AccessService } from '@w3ui/react-keyring'
import type { Service as UploadService } from '@w3ui/react-uploader'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import * as DID from '@ipld/dag-ucan/did'


export const serviceURL = new URL(
  //'https://staging.up.web3.storage'
  process.env.NEXT_PUBLIC_W3UP_SERVICE_URL ?? 'https://up.web3.storage'
)
export const servicePrincipal = DID.parse(
  //'did:web:staging.web3.storage'
  process.env.NEXT_PUBLIC_W3UP_SERVICE_DID ?? 'did:web:web3.storage'
)

export const serviceConnection = connect<AccessService & UploadService>({
  id: servicePrincipal,
  codec: CAR.outbound,
  channel: HTTP.open<any>({
    url: serviceURL,
    method: 'POST',
  }),
})

export const gatewayHost = process.env.NEXT_PUBLIC_W3UP_GATEWAY_HOST ?? 'w3s.link'
