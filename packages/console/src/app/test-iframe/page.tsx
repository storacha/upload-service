/**
 * Test Iframe Page - Only available in development
 * 
 * This page is automatically disabled.
 * Setting NEXT_PUBLIC_ENABLE_TEST_IFRAME=true will make it available at /test-iframe path
 * 
 */

'use client'

import { useEffect, useState } from 'react'

export default function TestIframePage() {
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState('user@example.com')
  const [userId, setUserId] = useState('user_123')
  const [provider, setProvider] = useState('dmail')
  const [iframeSize, setIframeSize] = useState<'small' | 'medium' | 'large'>('large')
  const [showMessageLog, setShowMessageLog] = useState(false)

  // Blocked access by default unless explicitly enabled
  const isTestingIframeEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_IFRAME === 'true'

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      
      setMessages(prev => [...prev, JSON.stringify(event.data)])
      
      // Handle console ready message
      if (event.data.type === 'CONSOLE_LOADED') {
        setMessages(prev => [...prev, 'Console loaded in iframe'])
      }
      
      // Handle authentication status updates
      if (event.data.type === 'AUTH_STATUS') {
        setMessages(prev => [...prev, `Auth status: ${event.data.status}`])
      }
      
      // Handle authentication completion
      if (event.data.type === 'SSO_AUTH_COMPLETE') {
        setMessages(prev => [...prev, `Authentication complete for: ${event.data.email}`])
      }
      
      // Handle requests for auth data
      if (event.data.type === 'REQUEST_SSO_AUTH_RESPONSE') {
        setMessages(prev => [...prev, 'Console is ready for authentication'])
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const sendSSOAuth = () => {
    if (iframeRef) {
      const authData = {
        type: 'SSO_AUTH_REQUEST',
        provider: provider,
        email: userEmail,
        userId: userId,
        sessionToken: 'test_session_token_123', // In real implementation, this would be a JWT
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev, `Sending ${provider.toUpperCase()} SSO auth: ${JSON.stringify(authData)}`])
      iframeRef.contentWindow?.postMessage(authData, window.location.origin)
    }
  }

  const clearMessages = () => setMessages([])

  const getIframeDimensions = () => {
    switch (iframeSize) {
      case 'small':
        return { width: '100%', height: '400px', containerClass: 'lg:col-span-1' }
      case 'medium':
        return { width: '100%', height: '600px', containerClass: 'lg:col-span-2' }
      case 'large':
        return { width: '100%', height: '800px', containerClass: 'lg:col-span-3' }
      default:
        return { width: '100%', height: '800px', containerClass: 'lg:col-span-3' }
    }
  }

  const dimensions = getIframeDimensions()

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
        <h1 className="text-3xl font-bold mb-8">Storacha Iframe Integration Test</h1>

        {/* Instructions and Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Test</h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-700">
              <li>The iframe loads the Storacha console automatically at <code>/iframe</code></li>
              <li>Select an SSO provider (DMAIL, Discord, GitHub, etc.)</li>
              <li>Enter a test email and user ID in the right panel</li>
              <li>Click &quot;Send Auth Request&quot; to simulate external SSO</li>
              <li>Open the message log to see the authentication flow</li>
              <li>The iframe should authenticate the user automatically via SSO</li>
            </ol>
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> For full SSO functionality, you need:
                <br />- Backend SSO service configured in upload-api
                <br />- W3infra validation service deployed for your provider
                <br />- Proper JWT token generation (currently using placeholder)
                <br />- Provider-specific API credentials and validation logic
              </p>
            </div>
          </div>

          {/* Control Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">SSO Platform Simulation</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSO Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder={`user@${provider === 'dmail' ? 'dmail.ai' : provider === 'discord' ? 'discord.com' : 'example.com'}`}
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder={`${provider}_user_123`}
                />
              </div>
              
              <button
                onClick={sendSSOAuth}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Send Auth Request
              </button>
              
              <button
                onClick={clearMessages}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                Clear Messages
              </button>

              <button
                onClick={() => setShowMessageLog(!showMessageLog)}
                className="w-full bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
              >
                {showMessageLog ? 'Hide' : 'Show'} Message Log ({messages.length})
              </button>
            </div>
          </div>
        </div>

        {/* Iframe Panel - Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={`bg-white rounded-lg shadow-lg p-6 ${dimensions.containerClass}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Storacha Console (Iframe)</h2>
              <span className="text-sm text-gray-500">
                Size: {iframeSize} ({dimensions.height})
              </span>
            </div>
            
            {/* Iframe size controls */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setIframeSize(size)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      iframeSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                    {size === 'small' && ' (400px)'}
                    {size === 'medium' && ' (600px)'}
                    {size === 'large' && ' (800px)'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border border-gray-300 rounded-md overflow-hidden" style={{ height: dimensions.height }}>
              <iframe
                ref={setIframeRef}
                src="/iframe"
                width="100%"
                height="100%"
                className="border-0"
                title="Storacha Console"
                style={{ width: '100%', height: 'calc(100% - 40px)' }}
              />
            </div>
          </div>
        </div>

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
                    messages.map((msg, index) => (
                      <div key={index} className="mb-2 p-3 bg-white rounded border-l-4 border-blue-500 shadow-sm">
                        <span className="text-xs text-gray-500 block mb-1">#{index + 1}</span>
                        <code className="text-sm">{msg}</code>
                      </div>
                    ))
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
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 