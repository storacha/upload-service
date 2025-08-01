'use client'
import { Provider } from '@storacha/ui-react'
import { serviceConnection, servicePrincipal, receiptsURL } from '@/components/services'
import { useIframe } from '@/contexts/IframeContext'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {TopLevelLoader} from './Loader'


export default function W3UIProvider ({ children }: { children: ReactNode }) {
  const { isIframe, isDetectionComplete } = useIframe()
  const pathname = usePathname()
  
  // Skip initial claim if it's an iframe OR if it's the /test-iframe page (which hosts the iframe)
  const shouldSkipInitialClaim = isIframe || pathname === '/test-iframe'
  
  // Don't render the Provider until iframe detection is complete to avoid race condition
  if (!isDetectionComplete) {
    return <TopLevelLoader />
  }
  
  return (
    <Provider
      connection={serviceConnection}
      servicePrincipal={servicePrincipal}
      receiptsEndpoint={receiptsURL}
      skipInitialClaim={shouldSkipInitialClaim}
    >
      <>{children}</>
    </Provider>
  )
}