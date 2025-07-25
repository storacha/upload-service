'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface IframeUser {
  authProvider: string
  email: string
  id: string
  sessionToken?: string
}

interface IframeContextType {
  isIframe: boolean
  isClient: boolean
  parentOrigin: string | null
  parentUser: IframeUser | null
  sendMessageToParent: (data: any) => void
  requestParentNavigation: (url: string) => void
}

const IframeContext = createContext<IframeContextType | undefined>(undefined)

export function IframeProvider({ children }: { children: ReactNode }) {
  const [isIframe, setIsIframe] = useState(false)
  const [parentOrigin, setParentOrigin] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [parentUser, setParentUser] = useState<IframeUser | null>(null)

  useEffect(() => {
    // Mark as client-side rendered
    setIsClient(true)
    
    // Detect if running in iframe
    const inIframe = window.self !== window.top
    setIsIframe(inIframe)

    if (inIframe) {
      // Listen for messages from parent
      const handleMessage = (event: MessageEvent) => {
        // Validate origin - in production, whitelist specific domains
        if (event.origin !== parentOrigin && parentOrigin === null) {
          setParentOrigin(event.origin)
        }

        // Handle parent messages
        if (event.data.type === 'IFRAME_INIT') {
          sendMessageToParent({ 
            type: 'CONSOLE_READY',
            url: window.location.href
          })
        }

        if (event.data.type === 'USER_AUTH') {
          console.log('Received user authentication from parent:', event.data.user)
          setParentUser(event.data.user)
          sendMessageToParent({
            type: 'AUTH_RECEIVED',
            user: event.data.user
          })
        }
      }

      window.addEventListener('message', handleMessage)
      
      // Notify parent that iframe is loaded
      window.parent?.postMessage({ 
        type: 'CONSOLE_LOADED',
        url: window.location.href 
      }, '*')

      return () => window.removeEventListener('message', handleMessage)
    }
  }, [parentOrigin])

  const sendMessageToParent = (data: any) => {
    if (isIframe && window.parent) {
      window.parent.postMessage(data, parentOrigin || '*')
    }
  }

  const requestParentNavigation = (url: string) => {
    sendMessageToParent({
      type: 'REQUEST_NAVIGATION',
      url
    })
  }

  return (
    <IframeContext.Provider value={{
      isIframe,
      isClient,
      parentOrigin,
      parentUser,
      sendMessageToParent,
      requestParentNavigation
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