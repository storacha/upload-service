/**
 * Test Iframe Page - Only available in development
 * 
 * This page is automatically disabled.
 * Setting NEXT_PUBLIC_ENABLE_TEST_IFRAME=true will make it available at /test-iframe path
 * 
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import SSOIntegrationGuide from '@/components/SSOIntegrationGuide'

export default function TestIframePage() {
  const [activeTab, setActiveTab] = useState('testing')

  const tabs = [
    { id: 'testing', label: 'Testing' },
    { id: 'integration', label: 'Integration Guide' }
  ]
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState('test@partner.example')
  const [userId, setUserId] = useState('partner_user_12345')
  const [sessionToken, setSessionToken] = useState('')
  const [provider, setProvider] = useState('dmail')
  const [showMessageLog, setShowMessageLog] = useState(false)
  const [communicationPort, setCommunicationPort] = useState<MessagePort | null>(null)
  const isInitializedRef = useRef(false)
  
  // New state for the improved flow
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [showSSOPopup, setShowSSOPopup] = useState(false)
  const [ssoStatus, setSSOStatus] = useState('')
  const [ssoComplete, setSSOComplete] = useState(false)
  const [ssoInProgress, setSSOInProgress] = useState(false)

  // Add iframe size controls back
  const [iframeWidth, setIframeWidth] = useState('100%')
  const [iframeHeight, setIframeHeight] = useState('800px')
  const [showSizeControls, setShowSizeControls] = useState(false)

  // Blocked access by default unless explicitly enabled
  const isTestingIframeEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_IFRAME === 'true'

  // Helper function to add timestamped messages with direction
  const addMessage = (message: string, direction: 'PARENT→IFRAME' | 'IFRAME→PARENT' | 'SYSTEM') => {
    const timestamp = new Date().toLocaleTimeString()
    const formattedMessage = `[${timestamp}] ${direction}: ${message}`
    setMessages(prev => [...prev, formattedMessage])
  }

  const loadIframe = () => {
    setMessages(prev => [...prev, 'Preparing iframe configuration...'])
    setShowSSOPopup(true)
  }

  const startSSO = () => {
    // First load the iframe if not already loaded
    if (!iframeLoaded) {
      setIframeLoaded(true)
      // Reset initialization flag for fresh start
      isInitializedRef.current = false
      addMessage(`Loading iframe with SSO provider: ${provider.toUpperCase()}`, 'SYSTEM')
      addMessage('Iframe URL: /iframe/?sso=' + provider, 'SYSTEM')
      setSSOStatus('Loading console and checking if user is already authenticated...')
      setSSOInProgress(true)
      setShowSSOPopup(false)
      return
    }

    if (communicationPort) {
      const authData = {
        type: 'AUTH_DATA',
        authProvider: provider,
        email: userEmail,
        externalUserId: userId,
        externalSessionToken: sessionToken ? sessionToken : 'unused'
      }
      
      addMessage(`Starting SSO with ${provider.toUpperCase()}: ${JSON.stringify(authData)}`, 'PARENT→IFRAME')
      setSSOInProgress(true)
      setSSOStatus('Sending authentication data...')
      setShowSSOPopup(false)
      communicationPort.postMessage(authData)
    } else {
      addMessage('Cannot start SSO - no MessageChannel port available', 'SYSTEM')
    }
  }

  // Listen for messages from iframe (MessageChannel setup)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      
      const { data, ports } = event
      addMessage(`Window message: ${JSON.stringify(data)}`, 'IFRAME→PARENT')
      
      // Handle console ready message with MessageChannel port
      if (data.type === 'CONSOLE_READY') {
        if (ports && ports.length > 0) {
          const port = ports[0]
          
          // Handle authenticated CONSOLE_READY even if already initialized
          if (isInitializedRef.current) {
            // If this is an authenticated status update, process it
            if (data.authenticated === true) {
              addMessage(`Authentication completed - user logged in.`, 'IFRAME→PARENT')
              setSSOStatus('Authentication successful')
              setSSOInProgress(false)
              setSSOComplete(true)
              return
            } else {
              // Ignore duplicate non-authenticated messages
              addMessage('Ignoring duplicate CONSOLE_READY message (React StrictMode)', 'SYSTEM')
              return
            }
          }
          isInitializedRef.current = true
          
          setCommunicationPort(port)
          
          // Set up port message handler
          port.onmessage = handlePortMessage
          
          addMessage(`Console ready for provider: ${data.provider} - MessageChannel established`, 'SYSTEM')
          
          // Check if console indicates user is already authenticated
          if (data.authenticated === true) {
            addMessage('Console reports user already authenticated', 'IFRAME→PARENT')
            setSSOStatus('Already authenticated')
            setSSOInProgress(false)
            setSSOComplete(true)
            return
          }
          
          // User not authenticated - wait for LOGIN_REQUEST from iframe
          setSSOStatus('Console ready - waiting for authentication request...')
          addMessage('User not authenticated - waiting for iframe to request auth data', 'SYSTEM')
          
        } else {
          addMessage('Console ready but no MessageChannel port received', 'SYSTEM')
        }
      }
    }

    const handlePortMessage = (event: MessageEvent) => {
      const { data } = event
      addMessage(`Port message: ${JSON.stringify(data)}`, 'IFRAME→PARENT')
      
      switch (data.type) {
        case 'LOGIN_REQUEST':
          addMessage(`Authentication requested for provider: ${data.provider}`, 'IFRAME→PARENT')
          setSSOStatus('Sending authentication data to iframe...')
          
          // Send auth data immediately when requested - use the event target (the port that sent the message)
          const responsePort = event.target as MessagePort
          if (responsePort) {
            const authData = {
              type: 'AUTH_DATA',
              authProvider: provider,
              email: userEmail,
              externalUserId: userId,
              externalSessionToken: sessionToken ? sessionToken : 'unused'
            }
            
            addMessage(`Sending auth data: ${JSON.stringify(authData)}`, 'PARENT→IFRAME')
            responsePort.postMessage(authData)
          } else {
            addMessage('ERROR: No response port available for AUTH_DATA', 'SYSTEM')
          }
          break
          
        case 'LOGIN_STATUS':
          const status = `Auth status: ${data.status}`
          addMessage(status, 'IFRAME→PARENT')
          setSSOStatus(status)
          break
          
        case 'LOGIN_COMPLETED':
          const completedMessage = `Authentication ${data.status}: ${data.error ? `- ${data.error}` : ''}`
          addMessage(completedMessage, 'IFRAME→PARENT')
          setSSOStatus(completedMessage)
          setSSOInProgress(false)
          setSSOComplete(data.status === 'success')
          break
          
        default:
          addMessage(`Unknown port message: ${data.type}`, 'IFRAME→PARENT')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      // Close communication port on cleanup
      if (communicationPort) {
        communicationPort.close()
        setCommunicationPort(null)
      }
      // Reset initialization flag for fresh start
      isInitializedRef.current = false
    }
  }, [provider, userEmail, userId, sessionToken])

  const clearMessages = () => setMessages([])

  // Block access if not enabled
  if (!isTestingIframeEnabled) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Page Not Available</h1>
          <p className="text-gray-600">
            This testing interface has been disabled
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Storacha Iframe Integration</h1>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium text-sm border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'testing' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Testing Interface</h2>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Test</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-700">
            <li>Click &quot;Load Iframe&quot; to configure the Single Sign-on (SSO) settings</li>
            <li>Configure your SSO provider and user details in the popup</li>
            <li>Click &quot;Start SSO&quot; - this will load the iframe</li>
            <li>If already authenticated: Console will immediately show your account</li>
            <li>If not authenticated: SSO flow will begin</li>
            <li>Monitor the SSO status as it progresses</li>
            <li>Once complete, you&apos;ll see the authenticated Storacha console</li>
          </ol>
          
          
        </div>

        {/* Control Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={loadIframe}
            disabled={iframeLoaded}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              iframeLoaded 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {iframeLoaded ? 'Console Active' : 'Start SSO Test'}
          </button>
          
          <button
            onClick={() => setShowMessageLog(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Show Communication Log ({messages.length})
          </button>

          {iframeLoaded && (
            <button
              onClick={() => setShowSizeControls(!showSizeControls)}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              {showSizeControls ? 'Hide' : 'Show'} Size Controls
            </button>
          )}
        </div>

        {/* Iframe Size Controls */}
        {showSizeControls && iframeLoaded && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-orange-800 mb-4">Iframe Size Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-2">
                  Width: {iframeWidth}
                </label>
                <div className="space-y-2">
                  {['100%', '90%', '80%', '70%', '1200px', '1000px', '800px', '600px', '400px'].map(width => (
                    <button
                      key={width}
                      onClick={() => setIframeWidth(width)}
                      className={`mr-2 mb-2 px-3 py-1 text-sm rounded transition-colors ${
                        iframeWidth === width 
                          ? 'bg-orange-600 text-white' 
                          : 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                      }`}
                    >
                      {width}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-2">
                  Height: {iframeHeight}
                </label>
                <div className="space-y-2">
                  {['400px', '500px', '600px', '700px', '800px', '900px', '1000px', '1200px'].map(height => (
                    <button
                      key={height}
                      onClick={() => setIframeHeight(height)}
                      className={`mr-2 mb-2 px-3 py-1 text-sm rounded transition-colors ${
                        iframeHeight === height 
                          ? 'bg-orange-600 text-white' 
                          : 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                      }`}
                    >
                      {height}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SSO Status Display */}
        {(ssoInProgress || ssoComplete) && (
          <div className="mb-8">
            <div className={`p-4 rounded-lg border-l-4 ${
              ssoComplete 
                ? (ssoStatus.includes('Already authenticated') 
                   ? 'bg-blue-50 border-blue-500 text-blue-800'
                   : 'bg-green-50 border-green-500 text-green-800')
                : 'bg-yellow-50 border-yellow-500 text-yellow-800'
            }`}>
              <div className="flex items-center">
                {ssoInProgress && !ssoStatus.includes('Already authenticated') && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-3"></div>
                )}
                <span className="font-semibold">
                  {ssoComplete 
                    ? (ssoStatus.includes('Already authenticated') ? 'Already Authenticated!' : 'SSO Complete!')
                    : 'SSO Status:'}
                </span>
              </div>
              <p className="mt-1">{ssoStatus}</p>
            </div>
          </div>
        )}

        {/* Iframe Container */}
        {iframeLoaded && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              Storacha Console 
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({iframeWidth} × {iframeHeight})
              </span>
            </h2>
            
            <div className="border border-gray-300 rounded-md overflow-hidden mx-auto" style={{ width: iframeWidth, height: iframeHeight }}>
              <iframe
                ref={setIframeRef}
                src={`/iframe/?sso=${provider}`}
                width="100%"
                height="100%"
                className="border-0"
                title="Storacha Console"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
                allow="payment"
              />
            </div>
          </div>
        )}

        {/* SSO Configuration Popup */}
        {showSSOPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Configure SSO Authentication</h3>
                <p className="text-sm text-gray-600 mt-1">Enter your authentication details to test the SSO flow</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSO Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="dmail">DMAIL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Email
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@dmail.ai"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="dmail_user_123"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Token (optional)
                  </label>
                  <input
                    type="text"
                    value={sessionToken}
                    onChange={(e) => setSessionToken(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Leave empty for test token"
                  />
                </div>
              </div>
              
              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={startSSO}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-semibold"
                >
                  Start SSO
                </button>
                <button
                  onClick={() => setShowSSOPopup(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Log Overlay */}
        {showMessageLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold">Message Log ({messages.length} messages)</h3>
                <button
                  onClick={() => setShowMessageLog(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold px-2"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <div className="bg-gray-50 rounded-md p-4 h-96 overflow-y-auto font-mono text-sm">
                  {messages.length === 0 ? (
                    <p className="text-gray-500">No messages yet...</p>
                  ) : (
                    messages.map((msg, index) => {
                      const isParentToIframe = msg.includes('PARENT→IFRAME')
                      const isIframeToParent = msg.includes('IFRAME→PARENT')
                      const isSystem = msg.includes('SYSTEM')
                      
                      return (
                        <div key={index} className={`mb-2 p-3 rounded border-l-4 shadow-sm ${
                          isParentToIframe 
                            ? 'bg-blue-50 border-blue-500' 
                            : isIframeToParent 
                            ? 'bg-green-50 border-green-500'
                            : 'bg-gray-50 border-gray-500'
                        }`}>
                          <span className="text-xs text-gray-500 block mb-1">#{index + 1}</span>
                          <code className={`text-sm ${
                            isParentToIframe 
                              ? 'text-blue-800' 
                              : isIframeToParent 
                              ? 'text-green-800'
                              : 'text-gray-800'
                          }`}>
                            {msg}
                          </code>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={clearMessages}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Clear All Messages
                  </button>
                  <button
                    onClick={() => setShowMessageLog(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                  <div className="flex-1 text-sm text-gray-600 flex items-center">
                    <span className="mr-4">
                      <span className="inline-block w-3 h-3 bg-blue-500 rounded mr-1"></span>
                      Parent → Iframe
                    </span>
                    <span className="mr-4">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>
                      Iframe → Parent
                    </span>
                    <span>
                      <span className="inline-block w-3 h-3 bg-gray-500 rounded mr-1"></span>
                      System
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        )}

        {/* Integration Guide Tab */}
        {activeTab === 'integration' && (
          <div>
            <SSOIntegrationGuide />
          </div>
        )}
      </div>
    </div>
  )
} 