import React, { useEffect, useState } from 'react'
import { getBackupPreview, getBackupDownload, formatBytes, formatDate } from '../api.js'

interface Props {
  backupId: number
  onBack: () => void
}

interface Preview {
  id: number
  chatName: string
  chatType: string
  messageCount: number
  sizeBytes: number
  createdAt: string
  cid: string
}

const CHAT_TYPE_ICONS: Record<string, string> = {
  private: '👤',
  group: '👥',
  channel: '📢',
  supergroup: '👥',
}

export default function BackupPreview({ backupId, onBack }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getBackupPreview(backupId)
      .then(setPreview)
      .catch((err: any) => setError(err.message || 'Failed to load preview'))
      .finally(() => setLoading(false))
  }, [backupId])

  async function handleDownload() {
    if (!preview?.cid) return
    setDownloading(true)
    try {
      const result = await getBackupDownload(backupId)
      window.open(result.downloadUrl, '_blank')
    } catch (err: any) {
      alert(err.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p>Loading preview…</p>
      </div>
    )
  }

  if (error || !preview) {
    return (
      <div style={styles.center}>
        <p style={{ color: 'red' }}>{error || 'Backup not found'}</p>
        <button style={styles.backBtn} onClick={onBack}>Back</button>
      </div>
    )
  }

  const icon = CHAT_TYPE_ICONS[preview.chatType] || '💬'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtnNav} onClick={onBack}>←</button>
        <h2 style={styles.title}>Backup Preview</h2>
        <span />
      </div>

      <div style={styles.chatCard}>
        <span style={styles.chatIcon}>{icon}</span>
        <div>
          <p style={styles.chatName}>{preview.chatName}</p>
          <p style={styles.chatType}>{preview.chatType}</p>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCell label="Messages" value={preview.messageCount.toLocaleString()} icon="💬" />
        <StatCell label="Size" value={formatBytes(preview.sizeBytes)} icon="📦" />
        <StatCell label="Created" value={formatDate(preview.createdAt)} icon="🗓️" />
        <StatCell label="Status" value="Encrypted" icon="🔒" />
      </div>

      {preview.cid && (
        <div style={styles.cidCard}>
          <p style={styles.cidLabel}>IPFS Content ID (CID)</p>
          <p style={styles.cidValue}>{preview.cid}</p>
          <a
            href={`https://w3s.link/ipfs/${preview.cid}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.cidLink}
          >
            View on IPFS gateway ↗
          </a>
        </div>
      )}

      <div style={styles.encCard}>
        <p style={styles.encTitle}>🔐 End-to-end encrypted</p>
        <p style={styles.encDesc}>
          This backup is encrypted with AES-256-CBC using a key derived from your Telegram ID. Only you can decrypt it.
        </p>
      </div>

      {preview.cid && (
        <button
          style={{ ...styles.downloadBtn, opacity: downloading ? 0.7 : 1 }}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Preparing…' : '⬇️  Download HTML'}
        </button>
      )}
    </div>
  )
}

function StatCell({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={styles.statCell}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px 16px 32px', minHeight: '100vh', background: 'var(--tg-theme-bg-color, #fff)', color: 'var(--tg-theme-text-color, #000)' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  backBtnNav: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--tg-theme-link-color, #007aff)' },
  backBtn: { background: 'var(--tg-theme-button-color, #007aff)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, cursor: 'pointer' },
  chatCard: { display: 'flex', alignItems: 'center', gap: 14, background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 },
  chatIcon: { fontSize: 36 },
  chatName: { fontSize: 18, fontWeight: 700, margin: 0 },
  chatType: { fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', margin: 0, textTransform: 'capitalize' as const },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  statCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 12, padding: '12px 8px', gap: 2 },
  statValue: { fontSize: 14, fontWeight: 700, textAlign: 'center' as const },
  statLabel: { fontSize: 11, color: 'var(--tg-theme-hint-color, #888)' },
  cidCard: { background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 },
  cidLabel: { fontSize: 12, color: 'var(--tg-theme-hint-color, #888)', margin: '0 0 4px' },
  cidValue: { fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' as const, margin: '0 0 6px' },
  cidLink: { fontSize: 13, color: 'var(--tg-theme-link-color, #007aff)' },
  encCard: { background: '#f0fff4', borderRadius: 12, padding: '12px 14px', marginBottom: 20 },
  encTitle: { fontSize: 14, fontWeight: 600, color: '#1a7a3a', margin: '0 0 4px' },
  encDesc: { fontSize: 13, color: '#2d7a4a', margin: 0, lineHeight: 1.5 },
  downloadBtn: { width: '100%', padding: '13px 0', background: '#34c759', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
}
