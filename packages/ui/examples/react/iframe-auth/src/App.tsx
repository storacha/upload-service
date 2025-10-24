import React from 'react'
import { useState, useEffect } from 'react'
import { Provider, useW3, useStorachaAuthEnhanced } from '@storacha/ui-react'
import { StorachaAuth } from '@storacha/ui-react-styled'

/**
 * Iframe Auth Example - Demonstrates iframe integration and session handoff
 * 
 * This example shows:
 * 1. How to embed Storacha auth in an iframe
 * 2. Automatic iframe detection
 * 3. Session persistence across pages
 * 4. Host-embedded auth flow
 */

// Component that runs inside the iframe
function IframeAuthApp() {
  const [{ accounts }] = useW3()
  const auth = useStorachaAuthEnhanced()

  return (
    <StorachaAuth
      enableIframeSupport={true}
      onAuthEvent={(event, props) => {
        console.log('🔐 Iframe Auth Event:', event, props)
      }}
    >
      <StorachaAuth.Ensurer>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#f8fafc'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            border: '2px solid #10b981',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{
              color: '#10b981',
              fontSize: '1.5rem',
              marginBottom: '1rem',
              fontWeight: 600
            }}>
              ✅ Authenticated in Iframe
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Signed in as:
            </p>
            <p style={{
              color: '#1e293b',
              fontFamily: 'monospace',
              background: '#f1f5f9',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              {accounts[0]?.toEmail()}
            </p>
            <button
              onClick={auth.logoutWithTracking}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </StorachaAuth.Ensurer>
    </StorachaAuth>
  )
}

// Host page that embeds the iframe
function HostPage() {
  const [iframeUrl, setIframeUrl] = useState('')
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'not-authenticated'>('checking')

  useEffect(() => {
    // In a real app, this would be your actual iframe URL
    setIframeUrl(window.location.href)

    // Simulate checking auth status from parent
    setTimeout(() => {
      setAuthStatus('not-authenticated')
    }, 1000)
  }, [])

  return (
    <div className="host-container">
      <div className="host-header">
        <h1>🔗 Iframe Integration Demo</h1>
        <p>Storacha authentication embedded in partner application</p>
      </div>

      <div className="iframe-demo-container">
        <div className="demo-card">
          <h2>Partner Application (Host)</h2>
          <p>
            This represents your application that wants to integrate Storacha authentication.
            The auth experience is embedded in an iframe.
          </p>

          <ul className="feature-list">
            <li>Automatic iframe detection</li>
            <li>Session persistence</li>
            <li>Secure message passing</li>
            <li>No redirect loops</li>
          </ul>

          <div className={`auth-status ${authStatus === 'authenticated' ? 'authenticated' : 'not-authenticated'}`}>
            <h3>
              {authStatus === 'checking' ? 'Checking...' :
               authStatus === 'authenticated' ? '✅ Authenticated' :
               '❌ Not Authenticated'}
            </h3>
            <p>
              {authStatus === 'checking' ? 'Verifying session...' :
               authStatus === 'authenticated' ? 'User session is active' :
               'User needs to authenticate'}
            </p>
          </div>

          <div className="code-example">
            <pre>{`<iframe
  src="https://console.storacha.network/auth"
  width="100%"
  height="600"
  allow="clipboard-write"
/>`}</pre>
          </div>
        </div>

        <div className="demo-card">
          <h2>Storacha Auth (Iframe)</h2>
          <p>
            This is the embedded authentication experience. It detects it's in an iframe
            and handles session management appropriately.
          </p>

          {/* Live iframe demo */}
          <div style={{ 
            border: '2px solid #e2e8f0',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            background: 'white'
          }}>
            <Provider>
              <IframeAuthApp />
            </Provider>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main app that decides whether to show iframe demo or the actual auth
function App() {
  // Check if we're in an iframe
  const isIframe = typeof window !== 'undefined' && window.self !== window.top

  // If in iframe, show the auth component
  // If not, show the demo host page
  return (
    <Provider>
      {isIframe ? <IframeAuthApp /> : <HostPage />}
    </Provider>
  )
}

export default App


