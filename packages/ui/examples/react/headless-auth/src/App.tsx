import React from 'react'
import { Provider, useW3, StorachaAuth, useStorachaAuth } from '@storacha/ui-react'

/**
 * Headless Auth Example - Demonstrates custom styling with Chakra-inspired design
 * 
 * This example shows how to use the headless @storacha/ui-react components
 * with completely custom styling. No pre-built CSS classes are used from Storacha.
 */

function CustomAuthForm() {
  const [{ handleRegisterSubmit, submitted }] = useStorachaAuth()

  return (
    <div className="auth-container">
      <StorachaAuth.Form
        className="auth-card"
        renderLogo={() => (
          <div className="auth-logo">
            <h1>🚀 Storacha</h1>
            <p>Headless Authentication Example</p>
          </div>
        )}
        renderEmailLabel={() => (
          <div className="auth-form-group">
            <label className="auth-label" htmlFor="email">
              Email Address
            </label>
          </div>
        )}
        renderSubmitButton={(disabled) => (
          <button
            className="auth-button"
            type="submit"
            disabled={disabled}
          >
            {disabled ? 'Sending...' : 'Sign In / Sign Up'}
          </button>
        )}
      >
        <StorachaAuth.EmailInput
          className="auth-input"
          placeholder="you@example.com"
        />
      </StorachaAuth.Form>
    </div>
  )
}

function CustomSubmitted() {
  const [{ email }] = useStorachaAuth()

  return (
    <div className="auth-container">
      <StorachaAuth.Submitted
        className="auth-card auth-submitted"
        renderLogo={() => (
          <div className="auth-logo">
            <h1>🚀 Storacha</h1>
          </div>
        )}
        renderTitle={() => <h2>Check your email!</h2>}
        renderMessage={(email) => (
          <p>
            We sent a verification link to{' '}
            <span className="email-highlight">{email}</span>
            <br />
            Click the link to complete authentication.
          </p>
        )}
        renderCancelButton={() => (
          <StorachaAuth.CancelButton className="auth-button">
            Cancel
          </StorachaAuth.CancelButton>
        )}
      />
    </div>
  )
}

function AuthenticatedApp() {
  const [{ accounts }] = useW3()
  const [, { logout }] = useStorachaAuth()

  return (
    <div className="authenticated-container">
      <div className="authenticated-card">
        <div className="authenticated-header">
          <h1>🎉 Welcome to Storacha!</h1>
          <p>You're successfully authenticated</p>
        </div>

        <div className="auth-info">
          <p>
            <strong>Signed in as:</strong>
            <br />
            {accounts[0]?.toEmail()}
          </p>
        </div>

        <button onClick={logout} className="logout-button">
          Sign Out
        </button>
      </div>
    </div>
  )
}

function App() {
  const handleAuthEvent = (event: string, properties?: Record<string, any>) => {
    console.log('🔐 Auth Event:', event, properties)
  }

  return (
    <Provider>
      <StorachaAuth
        onAuthEvent={handleAuthEvent}
        enableIframeSupport={false}
      >
        <StorachaAuth.Ensurer
          renderLoader={(type) => (
            <div className="auth-loader">
              <div className="spinner" />
              <p className="loader-text">
                {type === 'initializing' ? 'Initializing...' : 'Loading...'}
              </p>
            </div>
          )}
          renderForm={() => <CustomAuthForm />}
          renderSubmitted={() => <CustomSubmitted />}
        >
          <AuthenticatedApp />
        </StorachaAuth.Ensurer>
      </StorachaAuth>
    </Provider>
  )
}

export default App


