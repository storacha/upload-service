/**
 * Iframe Authentication Handler
 * 
 * Handles SSO authentication within iframe context using generic message types:
 * 
 * MESSAGE TYPES:
 * 
 * 1. CONSOLE_LOADED (Iframe -> Parent)
 *    - Sent when iframe finishes loading in the parent
 *    - Data: {url: string}
 * 
 * 2. REQUEST_SSO_AUTH (Iframe -> Parent) 
 *    - Iframe requests auth data from parent
 *    - Data: {}
 * 
 * 3. SSO_AUTH_REQUEST (Parent -> Iframe)
 *    - Parent sends SSO auth data (generic for any provider)
 *    - Data: {provider: string, email: string, userId: string, sessionToken: string}
 * 
 * 4. AUTH_STATUS (Iframe -> Parent)
 *    - Status updates during authentication
 *    - Data: {status: 'authenticating'|'authenticated'|'failed', email?: string}
 * 
 * 5. SSO_AUTH_COMPLETE (Iframe -> Parent)
 *    - Final authentication result
 *    - Data: {status: 'success'|'error', email?: string, error?: string}
 * 
 * 6. USER_AUTH (Parent -> Iframe) [IframeContext]
 *    - Simple user info sharing (from IframeContext)
 *    - Data: {user: {email: string, id: string}}
 */

'use client'

import { useIframe } from '@/contexts/IframeContext'
import { useW3, Authenticator } from '@storacha/ui-react'
import { useEffect, useState, ReactNode } from 'react'
import { Logo } from '@/brand'

interface IframeAuthenticatorProps {
  children: ReactNode
}

export default function IframeAuthenticator({ children }: IframeAuthenticatorProps) {
  const { isIframe, isClient, sendMessageToParent } = useIframe()
  const [{ client, accounts }] = useW3()
  const [authState, setAuthState] = useState<'pending' | 'authenticating' | 'authenticated' | 'failed'>('pending')
  const [error, setError] = useState<string | null>(null)
  
  const isAuthenticated = accounts.length > 0

  // Enhanced message handling for SSO
  useEffect(() => {
    if (!isClient || !isIframe) return

    const handleMessage = (event: MessageEvent) => {
      // Handle SSO authentication request
      if (event.data.type === 'SSO_AUTH_REQUEST') {
        console.log('Received SSO authentication from parent:', event.data)
        authenticateWithSSO(event.data)
      }

      // Handle request for auth data
      if (event.data.type === 'REQUEST_SSO_AUTH') {
        sendMessageToParent({
          type: 'REQUEST_SSO_AUTH_RESPONSE',
          status: 'ready'
        })
      }
    }

    window.addEventListener('message', handleMessage)
    
    // Notify parent that console is loaded
    sendMessageToParent({ 
      type: 'CONSOLE_LOADED',
      url: window.location.href 
    })

    return () => window.removeEventListener('message', handleMessage)
  }, [isClient, isIframe, sendMessageToParent])

  // SSO Authentication function
  const authenticateWithSSO = async (ssoData: any) => {
    const { provider, email, userId, sessionToken } = ssoData
    
    
    if (!provider || !email || !userId || !sessionToken) {
      setError(`Missing required SSO credentials for provider ${provider}`)
      setAuthState('failed')
      return
    }

    try {
      if (!client) {
        throw new Error('Client not initialized')
      }

      setAuthState('authenticating')
      sendMessageToParent({
        type: 'AUTH_STATUS',
        status: 'authenticating',
        email
      })

      // Use w3up client login with SSO parameters
      const loginResult = await client.login(email, {
        sso: {
          authProvider: provider,
          externalUserId: userId,
          externalSessionToken: sessionToken
        }
      })

      if ('error' in loginResult && loginResult.error) {
        const errorMessage = typeof loginResult.error === 'string' 
          ? loginResult.error 
          : 'SSO authentication failed'
        throw new Error(errorMessage)
      }

      setAuthState('authenticated')
      sendMessageToParent({
        type: 'SSO_AUTH_COMPLETE',
        status: 'success',
        email
      })

    } catch (err) {
      console.error('SSO authentication failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setAuthState('failed')
      sendMessageToParent({
        type: 'SSO_AUTH_COMPLETE',
        status: 'error',
        email,
        error: err instanceof Error ? err.message : 'Authentication failed'
      })
    }
  }

  // Monitor authentication state and notify parent
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User authenticated successfully!')
      sendMessageToParent({
        type: 'AUTH_STATUS',
        status: 'authenticated'
      })
    }
  }, [isAuthenticated, sendMessageToParent])

  // Don't render until client-side
  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // If not in iframe, use regular authenticator
  if (!isIframe) {
    return <Authenticator>{children}</Authenticator>
  }

  // Show authentication progress
  if (authState === 'authenticating') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Authenticating with SSO
        </h3>
        <p className="text-gray-600">
          Validating your credentials...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          This should take just a moment
        </p>
      </div>
    )
  }

  // Show authentication failure
  if (authState === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center mb-4">
            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-red-600 text-sm">✗</span>
            </div>
            <h3 className="text-lg font-medium text-red-800">Authentication Failed</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => {
              setAuthState('pending')
              setError(null)
            }}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Retry Authentication
          </button>
        </div>
      </div>
    )
  }

  // If waiting for authentication, show waiting state
  if (!isAuthenticated && authState === 'pending') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-pulse mb-4">
            <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-4"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Waiting for Authentication
          </h3>
          <p className="text-gray-500">
            Waiting for user credentials from external platform...
          </p>
        </div>
      </div>
    )
  }

  // If user is authenticated, show the console
  if (isAuthenticated || authState === 'authenticated') {
    return <Authenticator>{children}</Authenticator>
  }

  // Default: show preparation state
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center p-8">
        <Logo className="w-16 h-16 mx-auto mb-4 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Preparing Workspace
        </h3>
        <p className="text-gray-500">
          Setting up your Storacha workspace...
        </p>
      </div>
    </div>
  )
} 