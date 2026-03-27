import React, { useEffect, useState } from 'react'
import type { UserProfile, Backup } from '../api.js'
import { listBackups, deleteBackup, getBackupDownload, formatBytes, formatDate } from '../api.js'

interface Props {
  user: UserProfile | null
  onCreateNew: () => void
  onPreview: (id: number) => void
  onBack: () => void
  onUserUpdate: () => void
}

const CHAT_TYPE_ICONS: Record<string, string> = {
  private: '👤',
  group: '👥',
  channel: '📢',
  supergroup: '👥',
}

export default function BackupList({ user, onCreateNew, onPreview, onUserUpdate }: Props) {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await listBackups()
      setBackups(result.backups)
    } catch (err: any) {
      setError(err.message || 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: number, chatName: string) {
    if (!window.confirm?.(`Delete backup of "${chatName}"?`)) return
    setDeletingId(id)
    try {
      await deleteBackup(id)
      setBackups(prev => prev.filter(b => b.id !== id))
      onUserUpdate()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(id: number) {
    try {
      const result = await getBackupDownload(id)
      window.open(result.downloadUrl, '_blank')
    } catch (err: any) {
      alert(err.message || 'Download failed')
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.hint}>Loading backups…</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>My Backups</h2>
        <button style={styles.newBtn} onClick={onCreateNew}>+ New</button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {backups.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyIcon}>📭</p>
          <p style={styles.emptyText}>No backups yet.</p>
          <p style={styles.hint}>Create your first backup to get started!</p>
          <button style={styles.createBtn} onClick={onCreateNew}>Create Backup</button>
        </div>
      ) : (
        <div style={styles.list}>
          {backups.map(backup => (
            <div key={backup.id} style={styles.item}>
              <div style={styles.itemHeader}>
                <span style={styles.itemIcon}>
                  {CHAT_TYPE_ICONS[backup.chatType] || '💬'}
                </span>
                <div style={styles.itemInfo}>
                  <p style={styles.itemName}>{backup.chatName}</p>
                  <p style={styles.itemMeta}>
                    {backup.chatType} · {backup.messageCount} msgs · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>
                <span style={{ ...styles.statusBadge, ...getStatusStyle(backup.status) }}>
                  {backup.status}
                </span>
              </div>
              <p style={styles.itemDate}>{formatDate(backup.createdAt)}</p>
              <div style={styles.itemActions}>
                <button
                  style={styles.previewBtn}
                  onClick={() => onPreview(backup.id)}
                >
                  Preview
                </button>
                {backup.cid && (
                  <button
                    style={styles.downloadBtn}
                    onClick={() => handleDownload(backup.id)}
                  >
                    Download
                  </button>
                )}
                <button
                  style={{ ...styles.deleteBtn, opacity: deletingId === backup.id ? 0.5 : 1 }}
                  disabled={deletingId === backup.id}
                  onClick={() => handleDelete(backup.id, backup.chatName)}
                >
                  {deletingId === backup.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getStatusStyle(status: string): React.CSSProperties {
  if (status === 'completed') return { background: '#d4edda', color: '#155724' }
  if (status === 'failed') return { background: '#f8d7da', color: '#721c24' }
  return { background: '#fff3cd', color: '#856404' }
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
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },
  newBtn: {
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
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
    color: 'red',
    fontSize: 14,
    marginBottom: 12,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 600,
  },
  createBtn: {
    marginTop: 12,
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  item: {
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 12,
    padding: 14,
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  itemIcon: {
    fontSize: 24,
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: {
    fontSize: 12,
    opacity: 0.6,
    margin: 0,
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
  itemDate: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 10,
  },
  itemActions: {
    display: 'flex',
    gap: 8,
  },
  previewBtn: {
    flex: 1,
    padding: '7px 0',
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  downloadBtn: {
    flex: 1,
    padding: '7px 0',
    background: '#34c759',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteBtn: {
    flex: 1,
    padding: '7px 0',
    background: '#ff3b30',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
