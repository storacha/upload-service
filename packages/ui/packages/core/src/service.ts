import type { ServiceConf, Service } from '@storacha/client/types'
import { gatewayServiceConnection } from '@storacha/client/service'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import type { ConnectionView, Principal } from '@ucanto/interface'
import * as DID from '@ipld/dag-ucan/did'

export interface ServiceConfig {
  servicePrincipal?: Principal
  connection?: ConnectionView<Service>
}

export function createServiceConf({
  servicePrincipal,
  connection,
}: ServiceConfig = {}): ServiceConf {
  const id =
    servicePrincipal != null
      ? servicePrincipal
      : DID.parse('did:web:up.storacha.network')
  const serviceConnection =
    connection != null
      ? connection
      : connect<Service>({
          id,
          codec: CAR.outbound,
          channel: HTTP.open<Service>({
            url: new URL('https://up.storacha.network'),
            method: 'POST',
          }),
        })
  return {
    access: serviceConnection,
    upload: serviceConnection,
    filecoin: serviceConnection,
    gateway: gatewayServiceConnection(),
  }
}
