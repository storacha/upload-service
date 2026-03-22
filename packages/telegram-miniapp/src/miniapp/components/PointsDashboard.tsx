import React, { useEffect, useState } from 'react'
import type { UserProfile } from '../api.js'
import { getPoints, getPointsHistory, getTasks, completeTask } from '../api.js'

interface Props {
  user: UserProfile | null
  onBack: () => void
}

interface PointsData {
  points: number
  rank: number
  totalBytesUploaded: number
  plan: string
  tier: { name: string; color: string }
  nextTier: { name: string; pointsNeeded: number } | null
}

interface HistoryItem {
  id: number
  action: string
  pointsDelta: number
  description?: string
  createdAt: string
}

interface Task {
  taskType: string
  completed: boolean
  pointsAwarded: number
  completedAt?: string | null
}

const TASK_LABELS: Record<string, string> = {
  follow_x: 'Follow us on X (Twitter)',
  join_discord: 'Join our Discord',
  invite_friend: 'Invite a friend',
  share_backup: 'Share a backup',
}

export default function PointsDashboard({ user, onBack }: Props) {
  const [pointsData, setPointsData] = useState<PointsData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'history' | 'tasks'>('overview')

  useEffect(() => {
    getPoints().then(setPointsData).catch(() => {})
    getPointsHistory().then(r => setHistory(r.history)).catch(() => {})
    getTasks().then(r => setTasks(r.tasks)).catch(() => {})
  }, [])

  async function handleCompleteTask(taskType: string) {
    setCompletingTask(taskType)
    try {
      await completeTask(taskType)
      const [pd, ts] = await Promise.all([getPoints(), getTasks()])
      setPointsData(pd)
      setTasks(ts.tasks)
    } catch (err: any) {
      alert(err.message || 'Failed to complete task')
    } finally {
      setCompletingTask(null)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <h2 style={styles.title}>Points & Rewards</h2>
        <span />
      </div>

      {/* Points hero */}
      <div style={{ ...styles.heroCard, background: pointsData?.tier?.color || '#cd7f32' }}>
        <p style={styles.tierName}>{pointsData?.tier?.name || '…'} Tier</p>
        <p style={styles.pointsNum}>{(pointsData?.points ?? user?.points ?? 0).toLocaleString()}</p>
        <p style={styles.pointsLabel}>Total Points</p>
        {pointsData?.nextTier && (
          <p style={styles.nextTierNote}>
            {pointsData.nextTier.pointsNeeded} pts to {pointsData.nextTier.name}
          </p>
        )}
      </div>

      {/* Rank */}
      {pointsData && (
        <div style={styles.rankCard}>
          <span>🏅 Your rank:</span>
          <strong>#{pointsData.rank}</strong>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabRow}>
        {(['overview', 'history', 'tasks'] as const).map(t => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={styles.section}>
          <div style={styles.ruleCard}>
            <p style={styles.ruleTitle}>How points work</p>
            <div style={styles.rule}><span>📤 Upload backup</span><span>+1 pt / KB</span></div>
            <div style={styles.rule}><span>🗑️ Delete backup</span><span>-0.5 pts / KB</span></div>
            <div style={styles.rule}><span>🎯 Social tasks</span><span>up to +100 pts</span></div>
          </div>
          <div style={styles.ruleCard}>
            <p style={styles.ruleTitle}>Tier benefits</p>
            {[
              { name: 'Bronze', min: 0 },
              { name: 'Silver', min: 500 },
              { name: 'Gold', min: 2000 },
              { name: 'Platinum', min: 10000 },
              { name: 'Diamond', min: 50000 },
            ].map(tier => (
              <div key={tier.name} style={styles.rule}>
                <span>{tier.name}</span>
                <span style={styles.hint}>{tier.min.toLocaleString()}+ pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={styles.section}>
          {history.length === 0 ? (
            <p style={styles.empty}>No points history yet.</p>
          ) : (
            history.map(h => (
              <div key={h.id} style={styles.historyItem}>
                <div>
                  <p style={styles.historyDesc}>{h.description || h.action}</p>
                  <p style={styles.historyDate}>{new Date(h.createdAt).toLocaleDateString()}</p>
                </div>
                <span style={{ ...styles.historyDelta, color: h.pointsDelta >= 0 ? '#34c759' : '#ff3b30' }}>
                  {h.pointsDelta >= 0 ? '+' : ''}{h.pointsDelta}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div style={styles.section}>
          {tasks.map(task => (
            <div key={task.taskType} style={styles.taskCard}>
              <div>
                <p style={styles.taskName}>{TASK_LABELS[task.taskType] || task.taskType}</p>
                <p style={styles.taskPts}>+{task.pointsAwarded} pts</p>
              </div>
              {task.completed ? (
                <span style={styles.taskDone}>✅ Done</span>
              ) : (
                <button
                  style={{ ...styles.taskBtn, opacity: completingTask === task.taskType ? 0.6 : 1 }}
                  disabled={completingTask === task.taskType}
                  onClick={() => handleCompleteTask(task.taskType)}
                >
                  {completingTask === task.taskType ? '…' : 'Claim'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px 16px 32px', minHeight: '100vh', background: 'var(--tg-theme-bg-color, #fff)', color: 'var(--tg-theme-text-color, #000)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  backBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--tg-theme-link-color, #007aff)' },
  heroCard: { borderRadius: 16, padding: '20px 24px', textAlign: 'center', color: '#fff', marginBottom: 12, textShadow: '0 1px 3px rgba(0,0,0,0.25)' },
  tierName: { fontSize: 14, opacity: 0.85, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: 1 },
  pointsNum: { fontSize: 48, fontWeight: 800, margin: '4px 0', letterSpacing: -2 },
  pointsLabel: { fontSize: 13, opacity: 0.85, margin: 0 },
  nextTierNote: { fontSize: 12, opacity: 0.8, marginTop: 6 },
  rankCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14 },
  tabRow: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: { flex: 1, padding: '8px 0', background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--tg-theme-text-color, #555)', fontWeight: 500 },
  tabActive: { background: 'var(--tg-theme-button-color, #007aff)', color: 'var(--tg-theme-button-text-color, #fff)', fontWeight: 700 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  ruleCard: { background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 12, padding: '12px 14px' },
  ruleTitle: { fontSize: 14, fontWeight: 600, margin: '0 0 8px' },
  rule: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13 },
  hint: { color: 'var(--tg-theme-hint-color, #888)' },
  empty: { textAlign: 'center' as const, color: 'var(--tg-theme-hint-color, #888)', padding: '32px 0', fontSize: 14 },
  historyItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 10, padding: '10px 12px' },
  historyDesc: { fontSize: 13, margin: 0, fontWeight: 500 },
  historyDate: { fontSize: 11, color: 'var(--tg-theme-hint-color, #888)', margin: '2px 0 0' },
  historyDelta: { fontSize: 15, fontWeight: 700 },
  taskCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 12, padding: '12px 14px' },
  taskName: { fontSize: 14, fontWeight: 500, margin: 0 },
  taskPts: { fontSize: 12, color: '#34c759', margin: '2px 0 0', fontWeight: 600 },
  taskDone: { fontSize: 13, color: '#34c759', fontWeight: 600 },
  taskBtn: { background: 'var(--tg-theme-button-color, #007aff)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}
