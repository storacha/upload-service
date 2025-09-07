'use client'
import { createContext, useContext, useEffect, ReactNode } from 'react'
import { init, track } from '@plausible-analytics/tracker'

const PlausibleContext = createContext<any>(null)

// Global flag to prevent multiple initializations
let isInitialized = false

export function PlausibleProvider({ 
  children, 
  domain 
}: {
  children: ReactNode
  domain: string
}) {
  useEffect(() => {
    // Only initialize once
    if (!isInitialized) {
      try {
        init({ domain })
        isInitialized = true
        console.log('Plausible initialized for domain:', domain)
      } catch (error) {
        console.warn('Plausible initialization failed:', error)
      }
    }
  }, [domain])

  return (
    <PlausibleContext.Provider value={track}>
      {children}
    </PlausibleContext.Provider>
  )
}

export function usePlausible() {
  const trackEvent = useContext(PlausibleContext)
  if (!trackEvent) {
    throw new Error('usePlausible must be used within a PlausibleProvider')
  }
  return trackEvent
}
