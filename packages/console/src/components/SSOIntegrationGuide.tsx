'use client'

import { useState } from 'react'

export default function SSOIntegrationGuide() {
  const [activeTab, setActiveTab] = useState('overview')
  const [openExamples, setOpenExamples] = useState<Record<string, boolean>>({
    react: false
  })

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'implementation', label: 'Implementation' },
    { id: 'examples', label: 'Code Examples' },
    { id: 'testing', label: 'Testing' }
  ]

  const toggleExample = (exampleId: string) => {
    setOpenExamples(prev => ({
      ...prev,
      [exampleId]: !prev[exampleId]
    }))
  }

  const navigateToTab = (tabId: string) => {
    setActiveTab(tabId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Single Sign-On Integration Guide</h1>
          <p className="text-blue-100">Complete documentation for integrating Storacha SSO with your application</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Overview Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Integration Overview</h2>
              <p className="text-gray-700 text-lg leading-relaxed">
                The SSO integration allows users to authenticate with Storacha using their existing credentials 
                through a secure iframe-based flow. This guide will walk you through implementing the SSO flow in your web application.
              </p>
            </div>
            
            {/* How it Works */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
                How it works
              </h3>
              <ol className="space-y-3">
                <li className="flex items-start">
                  <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</span>
                  <span className="text-gray-700">Your web app creates a Storacha iframe with SSO provider parameter</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</span>
                  <span className="text-gray-700">Iframe automatically sends CONSOLE_READY message with MessageChannel port</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</span>
                  <span className="text-gray-700">When authentication is needed, iframe sends LOGIN_REQUEST to your app</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">4</span>
                  <span className="text-gray-700">Your app responds with AUTH_DATA containing user credentials/JWT</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">5</span>
                  <span className="text-gray-700">Storacha calls your validation API endpoint to verify credentials and sends LOGIN_COMPLETED with result</span>
                </li>
              </ol>
            </div>

            {/* Requirements */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-orange-100 text-orange-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">!</span>
                Requirements
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Modern browser with postMessage support</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">HTTPS endpoint (required for secure iframe communication)</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">User credentials or JWT token from your SSO provider</span>
                </li>
              </ul>
            </div>

            {/* Security Notes */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">🔒</span>
                Security Notes
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">🛡️</span>
                  <span className="text-gray-700">All communication happens through secure MessageChannel API</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">🔐</span>
                  <span className="text-gray-700">User credential validation occurs server-side via your provided API endpoint</span>
                </li>
              </ul>
            </div>

            {/* Next Step Navigation */}
            <div className="text-center">
              <button
                onClick={() => navigateToTab('implementation')}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next: Implementation Steps
                <span className="ml-2">→</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'implementation' && (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Implementation Steps</h2>
              <p className="text-gray-700 text-lg">Follow these simple steps to integrate SSO into your web application.</p>
            </div>

            {/* Prerequisites */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-amber-100 text-amber-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">⚠️</span>
                Prerequisites
              </h3>
              <p className="text-gray-700 mb-4">Before implementing, you must provide Storacha with the following information:</p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-amber-600 mr-3 mt-0.5">1.</span>
                  <div>
                    <span className="font-medium text-gray-900">Provider Name:</span>
                    <span className="text-gray-700"> A unique identifier for your SSO provider (e.g., &lsquo;dmail&rsquo;, &lsquo;mycompany&rsquo;)</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-600 mr-3 mt-0.5">2.</span>
                  <div>
                    <span className="font-medium text-gray-900">Domain URL:</span>
                    <span className="text-gray-700"> Your website domain (e.g., &lsquo;https://example.com&rsquo;) to be added to Storacha&rsquo;s CSP policies</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-600 mr-3 mt-0.5">3.</span>
                  <div>
                    <span className="font-medium text-gray-900">Validation API Endpoint:</span>
                    <span className="text-gray-700"> A secure HTTPS endpoint that Storacha will call to validate user authentication data (JWT tokens, session data, etc.)</span>
                  </div>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-amber-100 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> All three items are required before integration. Without CSP allowlist approval, the iframe will be blocked. Without the validation API endpoint, authentication will fail.
                </p>
              </div>
            </div>

            {/* Step 1 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
                Create the iframe
              </h3>
              <p className="text-gray-700 mb-4">Create an iframe pointing to the Storacha SSO endpoint (replace &lsquo;your-provider&rsquo; with your SSO provider name):</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`const iframe = document.createElement('iframe')
iframe.src = 'https://console.storacha.network/iframe?sso=your-provider'
iframe.style.width = '400px'
iframe.style.height = '600px'
iframe.title = 'Storacha Console'
iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation'
iframe.allow = 'payment'
document.body.appendChild(iframe)`}
            </pre>
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="text-yellow-600 mr-2">⚠️</span>
                Important Security Properties
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>
                  <span className="font-medium">sandbox:</span> Restricts iframe capabilities for security while allowing necessary operations
                </li>
                <li>
                  <span className="font-medium">allow=&quot;payment&quot;:</span> Required for Stripe checkout functionality in the Storacha console
                </li>
              </ul>
            </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
                Listen for iframe messages
              </h3>
              <p className="text-gray-700 mb-4">The iframe will send a window message with a MessageChannel port when ready (note: this is a window message, not a MessageChannel message, so it has origin):</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`let communicationPort = null

// Listen for the CONSOLE_READY message from iframe
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://console.storacha.network') return
  
  if (event.data.type === 'CONSOLE_READY') {
    // Iframe sends us a MessageChannel port
    if (event.ports && event.ports.length > 0) {
      communicationPort = event.ports[0]
      
      // Set up message handler for this port
      communicationPort.onmessage = handlePortMessage
      
      console.log('Communication established with iframe')
      
      // Check if user is already authenticated
      if (event.data.authenticated) {
        handleAuthSuccess(event.data)
      }
    }
  }
})`}
            </pre>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
                Handle authentication requests
              </h3>
              <p className="text-gray-700 mb-4">When the iframe needs authentication, it will send a LOGIN_REQUEST. Respond with your user data (note: MessageChannel messages don&rsquo;t have origin):</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`function handlePortMessage(event) {
  // Note: MessageChannel port messages don't have event.origin
  // Origin validation was done when the port was received
  const { data } = event
  
  switch (data.type) {
    case 'LOGIN_REQUEST':
      // Iframe is requesting authentication data
      const authData = {
        type: 'AUTH_DATA',
        authProvider: 'your-provider',
        email: 'user@example.com',
        externalUserId: 'user123',
        externalSessionToken: 'session-jwt-token'
      }
      
      // Send auth data back to iframe
      communicationPort.postMessage(authData)
      break
      
    case 'LOGIN_STATUS':
      console.log('Auth status:', data.status)
      break
      
    case 'LOGIN_COMPLETED':
      if (data.status === 'success') {
        handleAuthSuccess(data)
      } else {
        handleAuthError(data.error)
      }
      break
  }
}`}
            </pre>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</span>
                Handle authentication result
              </h3>
              <p className="text-gray-700 mb-4">Process the authentication result from the iframe:</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`function handleAuthSuccess(authData) {
  console.log('Authentication successful:', authData)
  // Handle successful authentication in your app
}

function handleAuthError(error) {
  console.error('Authentication failed:', error)
  // Handle authentication failure in your app
}`}
            </pre>
            </div>

            {/* Next Step Navigation */}
            <div className="text-center">
              <button
                onClick={() => navigateToTab('examples')}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next: Code Examples
                <span className="ml-2">→</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Complete Code Examples</h2>
              <p className="text-gray-700 text-lg">Ready-to-use code examples for different frameworks and environments.</p>
            </div>

            {/* React Example */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <button
                onClick={() => toggleExample('react')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center">
                  <span className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">⚛️</span>
                  <h3 className="text-xl font-semibold text-gray-900">React Component Example</h3>
                </div>
                <span className={`text-gray-500 transform transition-transform ${openExamples.react ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {openExamples.react && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import React, { useEffect, useRef, useState, useCallback } from 'react'

export function StorachaSSOLogin({ 
  onAuthSuccess, 
  onAuthError,
  provider = 'your-provider',
  userData = {
    email: 'user@example.com',
    externalUserId: 'user123',
    externalSessionToken: 'session-jwt'
  }
}) {
  const [isLoading, setIsLoading] = useState(false)
  const iframeRef = useRef(null)
  const communicationPortRef = useRef(null)
  const cleanupCalledRef = useRef(false)

  const cleanup = useCallback(() => {
    if (cleanupCalledRef.current) return
    cleanupCalledRef.current = true
    
    if (iframeRef.current) {
      iframeRef.current.remove()
      iframeRef.current = null
    }
    if (communicationPortRef.current) {
      communicationPortRef.current.close()
      communicationPortRef.current = null
    }
    setIsLoading(false)
  }, [])

  const handlePortMessage = useCallback((event) => {
    const { data } = event
    
    switch (data.type) {
      case 'LOGIN_REQUEST':
        // Send auth data when requested
        const authData = {
          type: 'AUTH_DATA',
          authProvider: provider,
          ...userData
        }
        if (communicationPortRef.current) {
          communicationPortRef.current.postMessage(authData)
        }
        break
        
      case 'LOGIN_COMPLETED':
        if (data.status === 'success') {
          onAuthSuccess?.(data)
        } else {
          onAuthError?.(data.error || 'Authentication failed')
        }
        cleanup()
        break
    }
  }, [provider, userData, onAuthSuccess, onAuthError, cleanup])

  const handleMessage = useCallback((event) => {
    if (event.origin !== 'https://console.storacha.network') return
    
    if (event.data.type === 'CONSOLE_READY') {
      if (event.ports && event.ports.length > 0) {
        const port = event.ports[0]
        communicationPortRef.current = port
        port.onmessage = handlePortMessage
        
        // Check if already authenticated
        if (event.data.authenticated) {
          onAuthSuccess?.(event.data)
          cleanup()
        }
      }
    }
  }, [handlePortMessage, onAuthSuccess, cleanup])

  const startSSOFlow = useCallback(() => {
    if (isLoading) return
    
    // Reset cleanup flag
    cleanupCalledRef.current = false
    setIsLoading(true)
    
    // Clean up any existing iframe
    cleanup()
    cleanupCalledRef.current = false
    
    // Create iframe
    const iframe = document.createElement('iframe')
    iframe.src = \`https://console.storacha.network/iframe?sso=\${provider}\`
    iframe.title = 'Storacha Console'
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation'
    iframe.allow = 'payment'
    iframe.style.cssText = \`
      width: 400px;
      height: 600px;
      border: none;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    \`
    
    iframeRef.current = iframe
    document.body.appendChild(iframe)
  }, [isLoading, provider, cleanup])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      cleanup()
    }
  }, [handleMessage, cleanup])
  
  return (
    <div>
      <button 
        onClick={startSSOFlow}
        disabled={isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Authenticating...' : 'Login with SSO'}
      </button>
    </div>
  )
}`}
                  </pre>
                </div>
              )}
            </div>



            {/* Next Step Navigation */}
            <div className="text-center">
              <button
                onClick={() => navigateToTab('testing')}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next: Testing Guide
                <span className="ml-2">→</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'testing' && (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Testing Your Integration</h2>
              <p className="text-gray-700 text-lg">Comprehensive testing guide to ensure your SSO integration works perfectly.</p>
            </div>

            {/* Test Environment Setup */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
                Test Environment Setup
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Ensure your app is served over HTTPS (required for MessageChannel)</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Test with a valid SSO account</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Check browser console for any errors</span>
                </li>
              </ul>
            </div>

            {/* Common Issues */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <span className="bg-orange-100 text-orange-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">⚠️</span>
                Common Issues and Solutions
              </h3>
              
              <div className="space-y-6">
                <div className="border-l-4 border-red-400 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Issue: Iframe blocked by CSP policies</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium text-red-600">Cause:</span> <span className="text-gray-700">Your domain is not in Storacha&rsquo;s CSP allowlist</span></p>
                    <p><span className="font-medium text-green-600">Solution:</span> <span className="text-gray-700">Contact Storacha team to add your domain to CSP policies before testing</span></p>
                  </div>
                </div>
                
                <div className="border-l-4 border-red-400 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Issue: MessageChannel not working</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium text-red-600">Cause:</span> <span className="text-gray-700">HTTP instead of HTTPS</span></p>
                    <p><span className="font-medium text-green-600">Solution:</span> <span className="text-gray-700">Serve your app over HTTPS</span></p>
                  </div>
                </div>
                
                <div className="border-l-4 border-red-400 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Issue: iframe not loading</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium text-red-600">Cause:</span> <span className="text-gray-700">Network connectivity or CORS issues</span></p>
                    <p><span className="font-medium text-green-600">Solution:</span> <span className="text-gray-700">Check network tab in browser dev tools</span></p>
                  </div>
                </div>
                
                <div className="border-l-4 border-red-400 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Issue: No CONSOLE_READY message received</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium text-red-600">Cause:</span> <span className="text-gray-700">Origin checking blocking the message or incorrect event listener</span></p>
                    <p><span className="font-medium text-green-600">Solution:</span> <span className="text-gray-700">Check event.origin matches console.storacha.network and window.addEventListener is set up before iframe creation</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Debug Tips */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">🔍</span>
                Debug Tips
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// Add debug logging to your window message handler
window.addEventListener('message', (event) => {
  console.log('Window message received:', event.data, 'from:', event.origin)
  
  if (event.data.type === 'CONSOLE_READY') {
    console.log('Console ready! Port received:', event.ports?.length > 0)
    console.log('Already authenticated:', event.data.authenticated)
  }
})

// Add debug logging to your port message handler
communicationPort.onmessage = (event) => {
  console.log('Port message received:', event.data)
  
  switch (event.data.type) {
    case 'LOGIN_REQUEST':
      console.log('Login requested for provider:', event.data.provider)
      break
    case 'LOGIN_STATUS':
      console.log('Login status update:', event.data.status)
      break
    case 'LOGIN_COMPLETED':
      console.log('Login completed:', event.data.status, event.data.error)
      break
  }
}

// Test iframe loading
iframe.onload = () => {
  console.log('Iframe loaded successfully at:', iframe.src)
}`}
            </pre>
            </div>

            {/* Testing Checklist */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">✓</span>
                Testing Checklist
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">Iframe loads correctly</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">CONSOLE_READY message is received with MessageChannel port</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">LOGIN_REQUEST is received when authentication is needed</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">AUTH_DATA is sent successfully to iframe</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">LOGIN_COMPLETED message with success/error status</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span className="text-gray-700">Multiple auth attempts work correctly</span>
                </li>
              </ul>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">🚀</span>
                Next Steps
              </h3>
              <p className="text-gray-700 mb-4">Once your integration is working:</p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-0.5">→</span>
                  <span className="text-gray-700">Test with different user accounts</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-0.5">→</span>
                  <span className="text-gray-700">Implement proper error handling and user feedback</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-0.5">→</span>
                  <span className="text-gray-700">Add loading states and UI polish</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-0.5">→</span>
                  <span className="text-gray-700">Test the Storacha client operations (create a new space & upload files)</span>
                </li>
              </ul>
            </div>

            {/* Congratulations */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Congratulations!</h3>
                <p className="text-lg text-gray-700 mb-4">
                  You&rsquo;ve successfully integrated Storacha into your application!
                </p>
                <p className="text-gray-600">
                  Your users can now seamlessly interact with Storacha through a Single Sign-On authorization flow,
                  enabling them to securely store and manage their data in the decentralized web.
                </p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}