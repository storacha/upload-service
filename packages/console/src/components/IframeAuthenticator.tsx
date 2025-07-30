/**
 * Iframe Authentication Handler
 * 
 * Handles SSO authentication within iframe context using MessageChannel:
 * 
 * MESSAGE TYPES:
 * 
 * 1. CONSOLE_READY (Iframe -> Parent)
 *    - Sent when iframe loads, includes MessageChannel port
 *    - Data: {provider: string, authenticated: boolean, port: MessagePort}
 * 
 * 2. LOGIN_REQUEST (Iframe -> Parent)
 *    - Iframe always requests auth data to validate/sync session
 *    - Data: {provider: string}
 * 
 * 3. AUTH_DATA (Parent -> Iframe)
 *    - Parent sends SSO auth data for validation/authentication
 *    - Data: {provider: string, email: string, userId: string, sessionToken: string}
 *    - If email matches current session, validation succeeds without re-auth
 *    - If email differs, performs account switching
 * 
 * 4. LOGIN_STATUS (Iframe -> Parent)
 *    - Status updates during authentication
 *    - Data: {status: 'authenticating'|'authenticated'|'failed'}
 * 
 * 5. LOGIN_COMPLETED (Iframe -> Parent)
 *    - Final authentication result
 *    - Data: {status: 'success'|'error', error?: string}
 * 
 */

'use client'

import { useIframe } from '@/contexts/IframeContext'
import { useW3, Authenticator } from '@storacha/ui-react'
import { useEffect, useState, useMemo, ReactNode } from 'react'
import { Logo } from '@/brand'
import { getAllowedOrigins, isOriginAllowed } from '@/lib/sso-origins'

interface IframeAuthenticatorProps {
  children: ReactNode
}

export default function IframeAuthenticator({ children }: IframeAuthenticatorProps) {
  const { isIframe, isClient, ssoProvider } = useIframe()
  const [{ client, accounts }, { logout }] = useW3()
  const [authState, setAuthState] = useState<'pending' | 'authenticating' | 'authenticated' | 'failed'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<MessageChannel | null>(null)
  const [parentOrigin, setParentOrigin] = useState<string | null>(null)
  
  const isAuthenticated = accounts.length > 0

  // Get allowed origins from shared utility (cached per process)
  const allowedOrigins = useMemo(() => {
    const origins = getAllowedOrigins()
    console.log(`SSO Allowed Origins: ${origins}`)
    return origins
  }, [])

  useEffect(() => {
    if (!isClient || !isIframe || !ssoProvider) return

    const setupMessageChannel = () => {
      // Detect parent origin for security validation
      let detectedOrigin: string
      try {
        detectedOrigin = window.parent.location.origin
      } catch (e) {
        // Cross-origin restriction - use document.referrer as fallback
        const referrer = document.referrer
        if (referrer) {
          const url = new URL(referrer)
          detectedOrigin = url.origin
        } else {
          console.error('Cannot detect parent origin for security validation')
          return
        }
      }

      // Validate parent origin against allowed list
      if (!isOriginAllowed(detectedOrigin, allowedOrigins)) {
        console.error(`Parent origin ${detectedOrigin} not allowed for SSO embedding`)
        setError(`Unauthorized embedding origin: ${detectedOrigin}`)
        setAuthState('failed')
        return
      }

      setParentOrigin(detectedOrigin)

      // Create MessageChannel for secure communication
      const messageChannel = new MessageChannel()
      setChannel(messageChannel)

      // Listen for messages from parent
      messageChannel.port1.onmessage = handleParentMessage

      // Send port to parent with CONSOLE_READY including current auth status
      window.parent.postMessage(
        { 
          type: 'CONSOLE_READY',
          provider: ssoProvider,
          authenticated: isAuthenticated
        },
        detectedOrigin,
        [messageChannel.port2]
      )

      // Always request authentication to validate/sync with parent session
      // If emails match, we validate the session and stay logged in
      // If emails differ, we handle account switching automatically
      // This ensures iframe auth state always matches parent SSO state
      requestAuthentication(messageChannel.port1)
    }

    setupMessageChannel()
    
    // Cleanup function to prevent duplicate listeners
    return () => {
      if (channel) {
        channel.port1.close()
      }
    }
  }, [isClient, isIframe, ssoProvider, isAuthenticated])

  const handleParentMessage = (event: MessageEvent) => {
    // Note: MessagePort events don't have an 'origin' property
    // Origin validation was already done during MessageChannel setup
    // so we can trust messages coming through the established channel
    
    switch (event.data.type) {
      case 'AUTH_DATA':
        authenticateWithSSO(event.data)
        break
      default:
        console.log('Unknown message type:', event.data.type)
    }
  }

  const requestAuthentication = (port: MessagePort) => {
    port.postMessage({
      type: 'LOGIN_REQUEST',
      provider: ssoProvider
    })
  }

  const sendLoginStatus = (status: string) => {
    if (!channel) {
      console.error('Cannot send LOGIN_STATUS: channel is null')
      return
    }
    
    channel.port1.postMessage({
      type: 'LOGIN_STATUS',
      status,
    })
  }

  const sendLoginCompleted = (status: 'success' | 'error', error?: string) => {
    if (!channel) {
      console.error('Cannot send LOGIN_COMPLETED: channel is null')
      return
    }

    channel.port1.postMessage({
      type: 'LOGIN_COMPLETED',
      status,
      error
    })
  }

  // SSO Authentication function with session validation
  const authenticateWithSSO = async (authData: any) => {
    const { provider, email, userId, sessionToken } = authData
    
    if (!provider || !email || !userId || !sessionToken) {
      const errorMsg = `Missing required SSO credentials for provider ${provider}`
      console.error(errorMsg)
      setError(errorMsg)
      setAuthState('failed')
      sendLoginCompleted('error', errorMsg)
      return
    }

    try {
      if (!client) {
        throw new Error('Client not initialized')
      }

      // Check if we're already authenticated with the same email
      const currentAccount = accounts.length > 0 ? accounts[0] : null
      const currentEmail = currentAccount?.toEmail()
      
      if (isAuthenticated && currentEmail === email) {
        // Session validation: same email, assume session is still valid
        setAuthState('authenticated')
        sendLoginStatus('authenticated')
        sendLoginCompleted('success')
        return
      }

      // Different email or not authenticated - proceed with authentication
      if (isAuthenticated && currentEmail !== email) {
        console.log(`Account switching detected: ${currentEmail} -> ${email}`)
        if (logout) {
          await logout()
        }
      }

      setAuthState('authenticating')
      sendLoginStatus('authenticating')

      // Use w3up client login with SSO parameters
      // The client will handle multiple accounts internally
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
      sendLoginStatus('authenticated')
      sendLoginCompleted('success')

    } catch (err) {
      console.error('SSO authentication failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
      setAuthState('failed')
      sendLoginCompleted('error', errorMessage)
    }
  }

  // Monitor authentication state and notify parent
  useEffect(() => {
    if (isAuthenticated && authState !== 'authenticated') {
      setAuthState('authenticated')
      sendLoginStatus('authenticated')
    }
  }, [isAuthenticated, authState])

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
              if (channel) {
                requestAuthentication(channel.port1)
              }
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
            Waiting for user credentials from {ssoProvider}...
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