import React from 'react'
import type { UserProfile } from '../api.js'
import { formatBytes } from '../api.js'
import type { View } from '../App.js'

interface Props {
  user: UserProfile | null
  onNavigate: (view: View) => void
  onUserUpdate: () => void
}

export default function Dashboard({ user, onNavigate }: Props) {
  const firstName = user?.firstName || 'User'
  const points = user?.points ?? 0
  const totalBytes = user?.totalBytesUploaded ?? 0
  const plan = user?.plan || 'free'

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.avatarWrap}>
          <div style={styles.avatar}>
            {firstName.charAt(0).toUpperCase()}
          </div>
        </div>
        <div style={styles.greeting}>
          <p style={styles.helloText}>Hello, {firstName}!</p>
          <span style={{ ...styles.planBadge, ...(plan === 'pro' ? styles.planBadgePro : styles.planBadgeFree) }}>
            {plan.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Points card */}
      <div style={styles.card}>
        <p style={styles.cardLabel}>Total Points</p>
        <p style={styles.pointsValue}>{points.toLocaleString()}</p>
        <p style={styles.cardLabel}>Storage used: {formatBytes(totalBytes)}</p>
      </div>

      {/* Quick actions */}
      <div style={styles.actionsGrid}>
        <button style={styles.actionBtn} onClick={() => onNavigate('backup-create')}>
          <span style={styles.actionIcon}>+</span>
          <span>New Backup</span>
        </button>
        <button style={styles.actionBtn} onClick={() => onNavigate('backup-list')}>
          <span style={styles.actionIcon}>📁</span>
          <span>My Backups</span>
        </button>
        <button style={styles.actionBtn} onClick={() => onNavigate('leaderboard')}>
          <span style={styles.actionIcon}>🏆</span>
          <span>Leaderboard</span>
        </button>
        <button style={styles.actionBtn} onClick={() => onNavigate('points')}>
          <span style={styles.actionIcon}>⭐</span>
          <span>Tasks</span>
        </button>
      </div>

      {/* Upgrade banner for free users */}
      {plan === 'free' && (
        <div style={styles.upgradeBanner}>
          <p style={styles.upgradeText}>
            Upgrade to Pro for unlimited storage and more points!
          </p>
          <button style={styles.upgradeBtn}>Upgrade to Pro</button>
        </div>
      )}

      {/* Storage stats */}
      <div style={styles.statsCard}>
        <p style={styles.statsTitle}>Storage Stats</p>
        <div style={styles.statsRow}>
          <span style={styles.statsLabel}>Total Uploaded</span>
          <span style={styles.statsValue}>{formatBytes(totalBytes)}</span>
        </div>
        <div style={styles.statsRow}>
          <span style={styles.statsLabel}>Points Earned</span>
          <span style={styles.statsValue}>{points.toLocaleString()}</span>
        </div>
        <div style={styles.statsRow}>
          <span style={styles.statsLabel}>Account Type</span>
          <span style={styles.statsValue}>{plan === 'pro' ? 'Pro' : 'Free'}</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    minHeight: '100vh',
    background: 'var(--tg-theme-bg-color, #ffffff)',
    color: 'var(--tg-theme-text-color, #000000)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  avatarWrap: {
    flexShrink: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 700,
  },
  greeting: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  helloText: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },
  planBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    width: 'fit-content',
  },
  planBadgeFree: {
    background: '#e0e0e0',
    color: '#555',
  },
  planBadgePro: {
    background: '#ffd700',
    color: '#7a5c00',
  },
  card: {
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    borderRadius: 16,
    padding: '20px 24px',
    textAlign: 'center',
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 13,
    opacity: 0.85,
    margin: '4px 0',
  },
  pointsValue: {
    fontSize: 40,
    fontWeight: 800,
    margin: '8px 0',
    letterSpacing: -1,
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    color: 'var(--tg-theme-text-color, #000000)',
    border: 'none',
    borderRadius: 12,
    padding: '14px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  actionIcon: {
    fontSize: 24,
  },
  upgradeBanner: {
    background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 20,
    textAlign: 'center',
  },
  upgradeText: {
    fontSize: 13,
    color: '#7a3a00',
    marginBottom: 10,
  },
  upgradeBtn: {
    background: '#ff6b35',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statsCard: {
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 12,
    padding: '14px 16px',
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 10,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  statsLabel: {
    fontSize: 13,
    opacity: 0.7,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: 600,
  },
}
