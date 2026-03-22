import React, { useState } from 'react'
import { login, getTelegramWebApp, UserProfile } from '../api.js'

interface Props {
  onLogin: (user: UserProfile) => void
}

export default function Login({ onLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tg = getTelegramWebApp()
  const tgUser = tg?.initDataUnsafe?.user

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      const result = await login()
      onLogin(result.user)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <span style={styles.emoji}>🔐</span>
        <h1 style={styles.title}>Storacha Chat Backup</h1>
        <p style={styles.subtitle}>
          Securely backup your Telegram chats with end-to-end encryption using
          decentralised storage.
        </p>
      </div>

      <div style={styles.features}>
        {[
          { icon: '🔒', text: 'End-to-end encrypted' },
          { icon: '💾', text: 'Stored on IPFS via Storacha' },
          { icon: '📥', text: 'Downloadable HTML archives' },
          { icon: '🏆', text: 'Earn points for every backup' },
        ].map((f) => (
          <div key={f.text} style={styles.feature}>
            <span style={styles.featureIcon}>{f.icon}</span>
            <span style={styles.featureText}>{f.text}</span>
          </div>
        ))}
      </div>

      {tgUser && (
        <div style={styles.userCard}>
          <span style={styles.avatar}>
            {tgUser.first_name?.[0]?.toUpperCase() ?? '?'}
          </span>
          <div>
            <div style={styles.userName}>
              {tgUser.first_name} {tgUser.last_name ?? ''}
            </div>
            {tgUser.username && (
              <div style={styles.userHandle}>@{tgUser.username}</div>
            )}
          </div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? 'Connecting…' : 'Get Started'}
      </button>

      <p style={styles.note}>
        By continuing you agree to Storacha's Terms of Service.
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
  hero: {
    textAlign: 'center',
    marginBottom: 28,
  },
  emoji: {
    fontSize: 56,
    display: 'block',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--tg-theme-text-color, #000)',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: 'var(--tg-theme-hint-color, #888)',
    lineHeight: 1.5,
    maxWidth: 300,
    margin: '0 auto',
  },
  features: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 24,
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid var(--tg-theme-secondary-bg-color, #f0f0f0)',
  },
  featureIcon: {
    fontSize: 22,
    minWidth: 28,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 14,
    color: 'var(--tg-theme-text-color, #333)',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 20,
    width: '100%',
    maxWidth: 360,
  },
  avatar: {
    width: 40,
    height: 40,
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #fff)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
  },
  userName: {
    fontWeight: 600,
    fontSize: 15,
    color: 'var(--tg-theme-text-color, #000)',
  },
  userHandle: {
    fontSize: 13,
    color: 'var(--tg-theme-hint-color, #888)',
  },
  error: {
    color: 'red',
    fontSize: 13,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: 'var(--tg-theme-hint-color, #aaa)',
    textAlign: 'center',
  },
}
