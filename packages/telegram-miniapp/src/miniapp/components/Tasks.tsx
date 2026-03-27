import React, { useEffect, useState } from 'react'
import type { Task } from '../api.js'
import { getTasks, completeTask } from '../api.js'

interface Props {
  onBack: () => void
}

const TASK_META: Record<string, { label: string; description: string; icon: string; points: number }> = {
  follow_x: {
    label: 'Follow on X (Twitter)',
    description: 'Follow @storacha on X to earn points.',
    icon: '𝕏',
    points: 50,
  },
  join_discord: {
    label: 'Join Discord',
    description: 'Join the Storacha Discord community.',
    icon: '💬',
    points: 50,
  },
  invite_friend: {
    label: 'Invite a Friend',
    description: 'Invite a friend to use Storacha Chat Backup.',
    icon: '🤝',
    points: 100,
  },
  share_backup: {
    label: 'Share a Backup',
    description: 'Share your first backup CID publicly.',
    icon: '📤',
    points: 25,
  },
}

export default function Tasks({ onBack }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await getTasks()
      setTasks(result.tasks)
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleClaim(taskType: string) {
    setClaiming(taskType)
    setClaimSuccess(null)
    setError(null)
    try {
      const result = await completeTask(taskType)
      setClaimSuccess(`+${result.pointsAwarded} points earned!`)
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to claim task')
    } finally {
      setClaiming(null)
    }
  }

  const totalEarned = tasks
    .filter(t => t.completed)
    .reduce((sum, t) => sum + t.pointsAwarded, 0)

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.hint}>Loading tasks…</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <h2 style={styles.title}>Social Tasks</h2>
        <div style={{ width: 60 }} />
      </div>

      <div style={styles.summaryCard}>
        <p style={styles.summaryLabel}>Points from tasks</p>
        <p style={styles.summaryValue}>{totalEarned.toLocaleString()}</p>
        <p style={styles.summarySubtext}>
          {tasks.filter(t => t.completed).length}/{tasks.length} tasks completed
        </p>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {claimSuccess && <p style={styles.successMsg}>{claimSuccess}</p>}

      <div style={styles.list}>
        {tasks.map(task => {
          const meta = TASK_META[task.taskType] || {
            label: task.taskType,
            description: '',
            icon: '✅',
            points: task.pointsAwarded,
          }
          return (
            <div
              key={task.taskType}
              style={{ ...styles.taskItem, ...(task.completed ? styles.taskCompleted : {}) }}
            >
              <div style={styles.taskIcon}>{meta.icon}</div>
              <div style={styles.taskInfo}>
                <p style={styles.taskLabel}>{meta.label}</p>
                <p style={styles.taskDesc}>{meta.description}</p>
                <p style={styles.taskPoints}>+{meta.points} pts</p>
              </div>
              <div style={styles.taskAction}>
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
            </div>
          )
        })}
      </div>

      <p style={styles.footerNote}>
        Complete tasks to earn bonus points and unlock rewards!
      </p>
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
  summaryCard: {
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    borderRadius: 14,
    padding: '18px 20px',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.85,
    margin: '0 0 4px',
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 800,
    margin: '0 0 4px',
  },
  summarySubtext: {
    fontSize: 12,
    opacity: 0.8,
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
  hint: {
    fontSize: 13,
    color: '#888',
  },
  error: {
    color: '#ff3b30',
    fontSize: 13,
    padding: '8px 12px',
    background: '#fff2f2',
    borderRadius: 8,
    marginBottom: 12,
  },
  successMsg: {
    color: '#155724',
    fontSize: 13,
    padding: '8px 12px',
    background: '#d4edda',
    borderRadius: 8,
    marginBottom: 12,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  taskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  taskCompleted: {
    opacity: 0.65,
  },
  taskIcon: {
    fontSize: 28,
    flexShrink: 0,
    width: 36,
    textAlign: 'center',
  },
  taskInfo: {
    flex: 1,
    minWidth: 0,
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: 600,
    margin: '0 0 2px',
  },
  taskDesc: {
    fontSize: 11,
    opacity: 0.65,
    margin: '0 0 4px',
    lineHeight: 1.4,
  },
  taskPoints: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--tg-theme-button-color, #007aff)',
  },
  taskAction: {
    flexShrink: 0,
  },
  claimBtn: {
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  doneTag: {
    fontSize: 13,
    fontWeight: 600,
    color: '#34c759',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.55,
    marginTop: 20,
    lineHeight: 1.5,
  },
}
