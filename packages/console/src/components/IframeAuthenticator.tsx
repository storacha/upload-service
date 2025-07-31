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
 *    - Data: {authProvider: string, email: string, externalUserId: string, externalSessionToken: string}
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
import { useEffect, useState, useMemo, ReactNode, useRef, useCallback } from 'react'
import { Logo } from '@/brand'
import { getAllowedOrigins, isOriginAllowed } from '@/lib/sso-origins'

// Global flag to prevent duplicate MessageChannel setup across React StrictMode cycles
let globalChannelSetup = false
let globalChannel: MessageChannel | null = null

// Helper function to log only in development
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}

interface IframeAuthenticatorProps {
  children: ReactNode
}

export default function IframeAuthenticator({ children }: IframeAuthenticatorProps) {
  const { isIframe, isClient, ssoProvider } = useIframe()
  const [{ client, accounts }, { logout }] = useW3()
  
  // Use ref to track latest client for retry logic
  const clientRef = useRef(client)
  clientRef.current = client
  
  // Log client availability changes
  const [authState, setAuthState] = useState<'pending' | 'authenticating' | 'authenticated' | 'failed'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<MessageChannel | null>(null)

  const [expectedSSOEmail, setExpectedSSOEmail] = useState<string | null>(null)
  const isChannelSetupRef = useRef(false)
  const channelRef = useRef<MessageChannel | null>(null)
  const emailMismatchLoggedRef = useRef<boolean>(false)
  
  const isAuthenticated = accounts.length > 0

  // Get allowed origins from shared utility (cached per process)
  const allowedOrigins = useMemo(() => {
    const origins = getAllowedOrigins()
    devLog(`SSO Allowed Origins: ${origins}`)
    return origins
  }, [])

  // Check for email mismatch during SSO
  const currentEmail = accounts.length > 0 ? accounts[0]?.toEmail() : null
  const hasEmailMismatch = isAuthenticated && expectedSSOEmail && currentEmail !== expectedSSOEmail

  // Log email mismatch only once when it changes
  useEffect(() => {
    if (hasEmailMismatch && !emailMismatchLoggedRef.current) {
      devLog('IFRAME: Preventing authenticated content load, waiting for SSO authentication...')
      emailMismatchLoggedRef.current = true
    } else if (!hasEmailMismatch && emailMismatchLoggedRef.current) {
      // Reset the flag when mismatch is resolved
      emailMismatchLoggedRef.current = false
    }
  }, [hasEmailMismatch, currentEmail, expectedSSOEmail])

  useEffect(() => {
    if (!isClient || !isIframe || !ssoProvider) return
    
    // Prevent multiple setups using global flag (React Strict Mode protection)
    if (globalChannelSetup && globalChannel) {
      devLog('IFRAME: Reusing existing MessageChannel (React StrictMode)')
      setChannel(globalChannel)
      channelRef.current = globalChannel
      isChannelSetupRef.current = true
      return
    }

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

      // Create MessageChannel for secure communication
      const messageChannel = new MessageChannel()
      devLog('IFRAME: Created new MessageChannel')
      
      // Store globally to prevent React Strict Mode duplication
      globalChannel = messageChannel
      globalChannelSetup = true
      
      setChannel(messageChannel)
      channelRef.current = messageChannel
      isChannelSetupRef.current = true

      // Listen for messages from parent
      messageChannel.port1.onmessage = handleParentMessage
      devLog('IFRAME: Assigned message handler to port1')

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
    
    // Cleanup function - only clean up if this is the last instance
    return () => {
      // Don't close global channel in cleanup - let it persist for React StrictMode
      // Only clean up local references
      if (channel && channel !== globalChannel) {
        channel.port1.close()
      }
      channelRef.current = null
      isChannelSetupRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleParentMessage = (event: MessageEvent) => {
    // Note: MessagePort events don't have an 'origin' property
    // Origin validation was already done during MessageChannel setup
    // so we can trust messages coming through the established channel
    
    devLog('IFRAME: Received message from parent:', event.data.type, event.data)
    
    switch (event.data.type) {
      case 'AUTH_DATA':
        devLog('IFRAME: Processing AUTH_DATA for email:', event.data.email)
        setExpectedSSOEmail(event.data.email)
        authenticateWithSSO(event.data)
        break
      default:
        devLog('IFRAME: Unknown message type:', event.data.type)
    }
  }

  const requestAuthentication = (port: MessagePort) => {
    port.postMessage({
      type: 'LOGIN_REQUEST',
      provider: ssoProvider
    })
  }

  const sendLoginStatus = useCallback((status: string, channelOverride?: MessageChannel) => {
    // Use provided channel, state channel, or ref channel
    const currentChannel = channelOverride || channel || channelRef.current
    if (!currentChannel) {
      console.error('Cannot send LOGIN_STATUS: channel is null')
      return
    }
    
    try {
      currentChannel.port1.postMessage({
        type: 'LOGIN_STATUS',
        status,
      })
    } catch (error) {
      console.error('Failed to send LOGIN_STATUS:', error)
    }
  }, [channel])

  const sendLoginCompleted = (status: 'success' | 'error', error?: string, channelOverride?: MessageChannel) => {
    // Use provided channel, state channel, or ref channel
    const currentChannel = channelOverride || channel || channelRef.current
    if (!currentChannel) {
      console.error('Cannot send LOGIN_COMPLETED: channel is null')
      return
    }

    try {
      currentChannel.port1.postMessage({
        type: 'LOGIN_COMPLETED',
        status,
        error
      })
    } catch (error) {
      console.error('Failed to send LOGIN_COMPLETED:', error)
    }
  }

  // SSO Authentication function with session validation
  const authenticateWithSSO = async (authData: any) => {
    devLog('IFRAME: authenticateWithSSO called with:', authData)
    const { authProvider, email, externalUserId, externalSessionToken } = authData
    
    if (!authProvider || !email || !externalUserId || !externalSessionToken) {
      const errorMsg = `Missing required SSO credentials for provider ${authProvider}`
      console.error('IFRAME: Missing SSO credentials:', errorMsg)
      setError(errorMsg)
      setAuthState('failed')
      sendLoginCompleted('error', errorMsg)
      return
    }

    try {
      // Check if client is properly initialized with required methods
      const currentClient = clientRef.current
      const isClientReady = currentClient && typeof currentClient.login === 'function'
      
      if (!isClientReady) {
        // Client not ready yet - wait and retry
        setAuthState('pending')
        sendLoginStatus('waiting for client initialization...')
        
        // Retry with reasonable interval for 5 minutes
        const retryAttempts = 15 // 15 attempts × 5 seconds
        let attempts = 0
        
        const retryInterval = setInterval(() => {
          attempts++
          const currentClient = clientRef.current // Get fresh client reference from ref
          const isCurrentClientReady = currentClient && typeof currentClient.login === 'function'
          
          if (isCurrentClientReady) {
            clearInterval(retryInterval)
            authenticateWithSSO(authData)
          } else if (attempts >= retryAttempts) {
            console.error('IFRAME: Client initialization timeout after', attempts, 'attempts (5 minutes)')
            clearInterval(retryInterval)
            const errorMsg = 'Client initialization timeout after 5 minutes - please refresh the page'
            setError(errorMsg)
            setAuthState('failed')
            sendLoginCompleted('error', errorMsg)
          }
        }, 5000) // Check every 5 seconds for 5 minutes total
        
        return
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
        devLog(`Account switching detected: ${currentEmail} -> ${email}`)
        if (logout) {
          await logout()
        }
      }

      setAuthState('authenticating')
      sendLoginStatus('authenticating')

      // Use w3up client login with SSO parameters
      // The client will handle multiple accounts internally
      const loginResult = await currentClient.login(email, {
        sso: {
          authProvider,
          externalUserId,
          externalSessionToken: externalSessionToken  || 'unused'
        }
      })

      if ('error' in loginResult && loginResult.error) {
        const errorMessage = typeof loginResult.error === 'string' 
          ? loginResult.error 
          : 'SSO authentication failed'
        console.error('IFRAME: client.login() failed with error:', JSON.stringify(loginResult, null, 2))
        throw new Error(errorMessage)
      }

      await currentClient.capability.access.claim()

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
  // BUT NOT during SSO email mismatch scenarios
  useEffect(() => {
    if (isAuthenticated && authState !== 'authenticated' && !hasEmailMismatch) {
      setAuthState('authenticated')
      sendLoginStatus('authenticated')
    }
  }, [isAuthenticated, authState, sendLoginStatus, hasEmailMismatch])

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
              if (window && window.parent) {
                window.parent.location.reload()
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
            Authentication
          </h3>
          <p className="text-gray-500">
            Waiting for user authentication in {ssoProvider}...
          </p>
        </div>
      </div>
    )
  }

  // Check for email mismatch during SSO and render appropriate UI
  if (hasEmailMismatch) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-pulse mb-4">
            <div className="w-16 h-16 bg-orange-200 rounded-full mx-auto mb-4"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Account Switching Required
          </h3>
          <p className="text-gray-500 mb-2">
            Current account: {currentEmail}
          </p>
          <p className="text-gray-500">
            Switching to: {expectedSSOEmail}
          </p>
        </div>
      </div>
    )
  }

  // If user is authenticated and no email mismatch, show the console
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