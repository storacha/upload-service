import React, { useEffect, useState } from 'react'
import { useStorachaAuth } from '@storacha/ui-react'

interface DmailAuthProps {
  onAuthSuccess: (email: string) => void
  onAuthError: (error: Error) => void
}

export function DmailAuth({ onAuthSuccess, onAuthError }: DmailAuthProps) {
  const [{ accounts, submitted, error }] = useStorachaAuth()
  const [dmailEmail, setDmailEmail] = useState('')

  useEffect(() => {
    if (accounts.length > 0) {
      const email = accounts[0].toEmail()
      if (email.endsWith('@dmail.ai')) {
        onAuthSuccess(email)
      } else {
        onAuthError(new Error('Please use a Dmail email address (@dmail.ai)'))
      }
    }
  }, [accounts, onAuthSuccess, onAuthError])

  useEffect(() => {
    if (error) {
      onAuthError(error)
    }
  }, [error, onAuthError])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDmailEmail(e.target.value)
  }

  const isDmailEmail = dmailEmail.endsWith('@dmail.ai')

  return (
    <div className="dmail-auth">
      <div className="auth-header">
        <div className="dmail-logo">📧</div>
        <h2>Connect with Dmail</h2>
        <p>Use your Dmail email to authenticate and access Storacha storage</p>
      </div>

      <StorachaAuth.Form className="dmail-auth-form">
        <div className="email-input-group">
          <label htmlFor="dmail-email">Dmail Email</label>
          <StorachaAuth.EmailInput
            id="dmail-email"
            placeholder="yourname@dmail.ai"
            value={dmailEmail}
            onChange={handleEmailChange}
            className="dmail-email-input"
          />
          {dmailEmail && !isDmailEmail && (
            <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Please use a Dmail email address (@dmail.ai)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitted || !isDmailEmail}
          className="dmail-auth-button"
        >
          {submitted ? 'Connecting...' : 'Connect with Dmail'}
        </button>
      </StorachaAuth.Form>

      <div className="dmail-features">
        <h3>Dmail Integration Features</h3>
        <ul>
          <li>🔐 Secure email-based authentication</li>
          <li>📁 Encrypted file storage</li>
          <li>📧 Send files via Dmail</li>
          <li>🔄 Sync across devices</li>
          <li>🌐 Decentralized infrastructure</li>
          <li>🔒 Privacy-first approach</li>
        </ul>
      </div>
    </div>
  )
}
