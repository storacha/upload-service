import React, { useState } from 'react'
import { verifyHumanode } from '../api.js'

interface Props {
  onVerified: () => void
  onSkip: () => void
}

const HUMANODE_AUTH_URL =
  typeof process !== 'undefined' && (process.env as any)?.VITE_HUMANODE_CLIENT_ID
    ? `https://auth.humanode.io/oauth2/auth?response_type=code&client_id=${(process.env as any).VITE_HUMANODE_CLIENT_ID}&scope=openid&redirect_uri=${encodeURIComponent(window.location.origin + '/humanode-callback')}`
    : null

export default function HumanodeVerify({ onVerified, onSkip }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'intro' | 'code'>('intro')

  async function handleVerify() {
    if (!code.trim()) {
      setError('Please enter the verification code')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await verifyHumanode(code.trim())
      if (result.verified) {
        onVerified()
      } else {
        setError('Verification failed. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  function openHumanodeAuth() {
    if (HUMANODE_AUTH_URL) {
      window.open(HUMANODE_AUTH_URL, '_blank')
      setStep('code')
    } else {
      // Dev environment — skip real OAuth
      setStep('code')
    }
  }

  return (
    <div style={styles.container}>
      <span style={styles.emoji}>🤖</span>
      <h2 style={styles.title}>Bot Prevention Check</h2>
      <p style={styles.subtitle}>
        To protect the platform we use{' '}
        <strong>Humanode BotBasher</strong> to verify you're a real person.
        This takes less than 30 seconds.
      </p>

      {step === 'intro' ? (
        <>
          <div style={styles.steps}>
            {[
              'Click the button below to open the Humanode verification page',
              'Complete the biometric check (face scan)',
              'Copy the verification code and paste it here',
            ].map((s, i) => (
              <div key={i} style={styles.step}>
                <span style={styles.stepNum}>{i + 1}</span>
                <span style={styles.stepText}>{s}</span>
              </div>
            ))}
          </div>

          <button style={styles.btn} onClick={openHumanodeAuth}>
            Start Verification
          </button>
          <button style={styles.skipBtn} onClick={onSkip}>
            Skip for now
          </button>
        </>
      ) : (
        <>
          <p style={styles.codeHint}>
            Paste the authorisation code from the Humanode page:
          </p>
          <input
            style={styles.input}
            type="text"
            placeholder="Paste code here…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? 'Verifying…' : 'Confirm'}
          </button>
          <button style={styles.skipBtn} onClick={() => setStep('intro')}>
            ← Back
          </button>
        </>
      )}

      <p style={styles.note}>
        Humanode does not store your biometric data after verification.
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 20px 24px',
    minHeight: '100vh',
    background: 'var(--tg-theme-bg-color, #fff)',
  },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--tg-theme-text-color, #000)',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--tg-theme-hint-color, #666)',
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 320,
    marginBottom: 24,
  },
  steps: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 24,
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid var(--tg-theme-secondary-bg-color, #f0f0f0)',
  },
  stepNum: {
    minWidth: 26,
    height: 26,
    background: 'var(--tg-theme-button-color, #007aff)',
    color: '#fff',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
  },
  stepText: {
    fontSize: 14,
    color: 'var(--tg-theme-text-color, #333)',
    lineHeight: 1.5,
  },
  codeHint: {
    fontSize: 14,
    color: 'var(--tg-theme-hint-color, #666)',
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 360,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--tg-theme-hint-color, #ccc)',
    fontSize: 14,
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    color: 'var(--tg-theme-text-color, #000)',
    marginBottom: 12,
    outline: 'none',
  },
  error: {
    color: 'red',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    maxWidth: 360,
    padding: '14px 0',
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #fff)',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 10,
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--tg-theme-hint-color, #888)',
    fontSize: 14,
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: 16,
  },
  note: {
    fontSize: 12,
    color: 'var(--tg-theme-hint-color, #aaa)',
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 'auto',
  },
}
