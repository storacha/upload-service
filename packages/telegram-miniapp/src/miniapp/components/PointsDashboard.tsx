import React, { useEffect, useState } from 'react'
import type { UserProfile } from '../api.js'
import { getPointsHistory, getTasks, completeSocialTask, formatBytes } from '../api.js'

interface Props {
  user: UserProfile | null
  onBack: () => void
}

interface PointsData {
  history: Array<{ id: number; action: string; pointsDelta: number; description?: string; createdAt: string }>
  totalPoints: number
  tier: { name: string; color: string; minPoints: number }
  nextTier: { name: string; color: string; minPoints: number; pointsNeeded: number } | null
}

interface SocialTask {
  taskType: string
  completed: boolean
  pointsAwarded: number
}

const TASK_LABELS: Record<string, { label: string; icon: string; points: number }> = {
  follow_x: { label: 'Follow on X', icon: '𝕏', points: 50 },
  join_discord: { label: 'Join Discord', icon: '💬', points: 50 },
  invite_friend: { label: 'Invite a Friend', icon: '🤝', points: 100 },
  share_backup: { label: 'Share a Backup', icon: '📤', points: 25 },
}

export default function PointsDashboard({ user, onBack }: Props) {
  const [pointsData, setPointsData] = useState<PointsData | null>(null)
  const [socialTasks, setSocialTasks] = useState<SocialTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [historyResult, tasksResult] = await Promise.all([
        getPointsHistory(20),
        getTasks(),
      ])
      setPointsData(historyResult)
      setSocialTasks(tasksResult.tasks.map((t: any) => ({
        taskType: t.taskType,
        completed: t.completed,
        pointsAwarded: t.pointsAwarded,
      })))
    } catch (err: any) {
      setError(err.message || 'Failed to load points data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleClaim(taskType: string) {
    setClaiming(taskType)
    try {
      await completeSocialTask(taskType)
      await load()
    } catch (err: any) {
      alert(err.message || 'Claim failed')
    } finally {
      setClaiming(null)
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.hint}>Loading…</p>
      </div>
    )
  }

  const tier = pointsData?.tier
  const nextTier = pointsData?.nextTier
  const totalPoints = user?.points ?? pointsData?.totalPoints ?? 0

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <h2 style={styles.title}>Points & Rewards</h2>
        <div style={{ width: 60 }} />
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {/* Points hero */}
      <div style={{ ...styles.tierCard, borderColor: tier?.color || '#007aff' }}>
        <p style={{ ...styles.tierName, color: tier?.color || '#007aff' }}>
          {tier?.name || 'Bronze'} Tier
        </p>
        <p style={styles.totalPoints}>{totalPoints.toLocaleString()}</p>
        <p style={styles.pointsLabel}>total points</p>
        {nextTier && (
          <p style={styles.nextTierText}>
            {nextTier.pointsNeeded.toLocaleString()} pts to {nextTier.name}
          </p>
        )}
      </div>

      {/* Storage stat */}
      {user && (
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <p style={styles.statVal}>{formatBytes(user.totalBytesUploaded)}</p>
            <p style={styles.statLabel}>Uploaded</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statVal}>{user.plan === 'pro' ? 'Pro' : 'Free'}</p>
            <p style={styles.statLabel}>Plan</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statVal}>{socialTasks.filter(t => t.completed).length}/{socialTasks.length}</p>
            <p style={styles.statLabel}>Tasks done</p>
          </div>
        </div>
      )}

      {/* Social tasks */}
      <p style={styles.sectionTitle}>Social Tasks</p>
      <div style={styles.taskList}>
        {socialTasks.map(task => {
          const meta = TASK_LABELS[task.taskType] || { label: task.taskType, icon: '✅', points: task.pointsAwarded }
          return (
            <div key={task.taskType} style={{ ...styles.taskItem, opacity: task.completed ? 0.65 : 1 }}>
              <span style={styles.taskIcon}>{meta.icon}</span>
              <div style={styles.taskInfo}>
                <p style={styles.taskLabel}>{meta.label}</p>
                <p style={styles.taskPts}>+{meta.points} pts</p>
              </div>
              {task.completed ? (
                <span style={styles.doneTag}>Done ✓</span>
              ) : (
                <button
                  style={{ ...styles.claimBtn, opacity: claiming === task.taskType ? 0.6 : 1 }}
                  disabled={claiming === task.taskType}
                  onClick={() => handleClaim(task.taskType)}
                >
                  {claiming === task.taskType ? '…' : 'Claim'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Points history */}
      {pointsData && pointsData.history.length > 0 && (
        <>
          <p style={styles.sectionTitle}>Recent Activity</p>
          <div style={styles.historyList}>
            {pointsData.history.map(item => (
              <div key={item.id} style={styles.historyItem}>
                <div style={styles.historyLeft}>
                  <p style={styles.historyDesc}>{item.description || item.action}</p>
                  <p style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <span style={{ ...styles.historyPts, color: item.pointsDelta >= 0 ? '#34c759' : '#ff3b30' }}>
                  {item.pointsDelta >= 0 ? '+' : ''}{item.pointsDelta}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--tg-theme-button-color, #007aff)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: 10,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #eee',
    borderTop: '3px solid var(--tg-theme-button-color, #007aff)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  hint: { fontSize: 13, color: '#888' },
  error: {
    color: '#ff3b30',
    fontSize: 13,
    marginBottom: 12,
    padding: '8px 12px',
    background: '#fff2f2',
    borderRadius: 8,
  },
  tierCard: {
    textAlign: 'center',
    padding: '20px 16px',
    borderRadius: 16,
    border: '2px solid',
    marginBottom: 16,
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
  },
  tierName: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    margin: '0 0 8px',
  },
  totalPoints: {
    fontSize: 44,
    fontWeight: 800,
    margin: '0 0 4px',
    letterSpacing: -2,
  },
  pointsLabel: {
    fontSize: 12,
    opacity: 0.6,
    margin: '0 0 8px',
  },
  nextTierText: {
    fontSize: 12,
    opacity: 0.7,
    margin: 0,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 10,
    padding: '10px 6px',
    textAlign: 'center',
  },
  statVal: {
    fontSize: 15,
    fontWeight: 700,
    margin: '0 0 2px',
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.6,
    margin: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 10,
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 20,
  },
  taskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 10,
    padding: '10px 12px',
  },
  taskIcon: {
    fontSize: 22,
    flexShrink: 0,
    width: 30,
    textAlign: 'center',
  },
  taskInfo: { flex: 1 },
  taskLabel: {
    fontSize: 13,
    fontWeight: 600,
    margin: '0 0 2px',
  },
  taskPts: {
    fontSize: 11,
    color: 'var(--tg-theme-button-color, #007aff)',
    margin: 0,
    fontWeight: 600,
  },
  doneTag: {
    fontSize: 12,
    fontWeight: 600,
    color: '#34c759',
    flexShrink: 0,
  },
  claimBtn: {
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 10,
    padding: '10px 12px',
  },
  historyLeft: {
    flex: 1,
    minWidth: 0,
  },
  historyDesc: {
    fontSize: 13,
    margin: '0 0 2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  historyDate: {
    fontSize: 11,
    opacity: 0.55,
    margin: 0,
  },
  historyPts: {
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    marginLeft: 10,
  },
}
