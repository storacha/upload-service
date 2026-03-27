import React, { useEffect, useState, useCallback } from 'react'
import { login, getMe, getTelegramWebApp, UserProfile } from './api.js'
import Login from './components/Login.js'
import HumanodeVerify from './components/HumanodeVerify.js'
import Dashboard from './components/Dashboard.js'
import BackupList from './components/BackupList.js'
import BackupCreate from './components/BackupCreate.js'
import BackupPreview from './components/BackupPreview.js'
import Leaderboard from './components/Leaderboard.js'
import PointsDashboard from './components/PointsDashboard.js'

export type View =
  | 'login'
  | 'humanode-verify'
  | 'dashboard'
  | 'backup-list'
  | 'backup-create'
  | 'backup-preview'
  | 'leaderboard'
  | 'points'

export default function App() {
  const [view, setView] = useState<View>('login')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null)

  const tg = getTelegramWebApp()

  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
    }
  }, [])

  useEffect(() => {
    // Parse start_param from Telegram deep link to set initial view
    const startParam = tg?.initDataUnsafe?.start_param
    if (startParam === 'leaderboard') setView('leaderboard')
    else if (startParam === 'dashboard') setView('dashboard')
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      try {
        const result = await login()
        setUser(result.user)
        if (!result.user.humanodeVerified) {
          setView('humanode-verify')
        } else {
          setView('dashboard')
        }
      } catch (err: any) {
        // In development without Telegram context, show login screen
        if (import.meta.env.DEV) {
          setView('dashboard')
        } else {
          setError(err.message || 'Authentication failed')
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const updated = await getMe()
      setUser(updated)
    } catch (_) {
      // ignore
    }
  }, [])

  const navigate = useCallback((v: View, backupId?: number) => {
    if (backupId !== undefined) setSelectedBackupId(backupId)
    setView(v)
    tg?.BackButton?.show()
  }, [tg])

  const goBack = useCallback(() => {
    setView('dashboard')
    tg?.BackButton?.hide()
  }, [tg])

  useEffect(() => {
    if (!tg?.BackButton) return
    const handler = () => goBack()
    tg.BackButton.onClick(handler)
    return () => tg.BackButton?.offClick(handler)
  }, [tg, goBack])

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>⚠️</p>
        <p style={{ color: 'red', textAlign: 'center', padding: '0 24px' }}>{error}</p>
        <button
          style={styles.retryBtn}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  if (view === 'login') {
    return <Login onLogin={(u) => { setUser(u); setView('humanode-verify') }} />
  }

  if (view === 'humanode-verify') {
    return (
      <HumanodeVerify
        onVerified={() => { refreshUser(); setView('dashboard') }}
        onSkip={() => setView('dashboard')}
      />
    )
  }

  if (view === 'leaderboard') {
    return <Leaderboard user={user} onBack={goBack} />
  }

  if (view === 'points') {
    return <PointsDashboard user={user} onBack={goBack} />
  }

  if (view === 'backup-create') {
    return (
      <BackupCreate
        user={user}
        onSuccess={(updatedUser) => { setUser(updatedUser); setView('backup-list') }}
        onBack={goBack}
      />
    )
  }

  if (view === 'backup-preview' && selectedBackupId !== null) {
    return (
      <BackupPreview
        backupId={selectedBackupId}
        onBack={() => setView('backup-list')}
      />
    )
  }

  if (view === 'backup-list') {
    return (
      <BackupList
        user={user}
        onCreateNew={() => navigate('backup-create')}
        onPreview={(id) => navigate('backup-preview', id)}
        onBack={goBack}
        onUserUpdate={refreshUser}
      />
    )
  }

  // Default: dashboard
  return (
    <Dashboard
      user={user}
      onNavigate={navigate}
      onUserUpdate={refreshUser}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: 12,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #eee',
    borderTop: '4px solid #007aff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 16,
    padding: '10px 24px',
    background: '#007aff',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    cursor: 'pointer',
  },
}
