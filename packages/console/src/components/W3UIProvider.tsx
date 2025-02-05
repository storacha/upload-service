'use client'
import { Provider } from '@w3ui/react'
import { serviceConnection, servicePrincipal, receiptsURL } from '@/components/services'
import { ReactNode } from 'react'


export default function W3UIProvider ({ children }: { children: ReactNode }) {
  return (
    <Provider
      connection={serviceConnection}
      servicePrincipal={servicePrincipal}
      receiptsEndpoint={receiptsURL}
    >
      <>{children}</>
    </Provider>
  )
}