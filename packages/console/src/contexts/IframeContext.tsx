'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface IframeContextType {
  isIframe: boolean
  isClient: boolean
  ssoProvider: string | null
  isDetectionComplete: boolean
}

const IframeContext = createContext<IframeContextType | undefined>(undefined)

export function IframeProvider({ children }: { children: ReactNode }) {
  const [isIframe, setIsIframe] = useState(false)
  const [ssoProvider, setSsoProvider] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [isDetectionComplete, setIsDetectionComplete] = useState(false)

  useEffect(() => {
    // Mark as client-side rendered
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true)

    // Detect if running in iframe
    const inIframe = window.self !== window.top

    // Extract SSO provider from URL query parameter
    const urlParams = new URLSearchParams(window.location.search)
    const provider = urlParams.get('sso')

    if (inIframe && provider) {
      setIsIframe(true)
      setSsoProvider(provider)
    }

    // Mark detection as complete
    setIsDetectionComplete(true)
  }, [])

  return (
    <IframeContext.Provider value={{
      isIframe,
      isClient,
      ssoProvider,
      isDetectionComplete
    }}>
      {children}
    </IframeContext.Provider>
  )
}

export function useIframe() {
  const context = useContext(IframeContext)
  if (context === undefined) {
    throw new Error('useIframe must be used within an IframeProvider')
  }
  return context
} 