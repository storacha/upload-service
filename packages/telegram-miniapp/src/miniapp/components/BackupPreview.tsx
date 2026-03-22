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

export default function BackupPreview({ backupId, onBack }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadLoading, setDownloadLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getBackupPreview(backupId)
        setPreview(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load preview')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [backupId])

  async function handleDownload() {
    if (!preview) return
    setDownloadLoading(true)
    try {
      const result = await getBackupDownload(backupId)
      window.open(result.downloadUrl, '_blank')
    } catch (err: any) {
      alert(err.message || 'Download failed')
    } finally {
      setDownloadLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.hint}>Loading preview…</p>
      </div>
    )
  }

  if (error || !preview) {
    return (
      <div style={styles.center}>
        <p style={styles.errorEmoji}>⚠️</p>
        <p style={styles.error}>{error || 'Backup not found'}</p>
        <button style={styles.backBtn} onClick={onBack}>← Go Back</button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button style={styles.navBackBtn} onClick={onBack}>← Back</button>
        <h2 style={styles.title}>Backup Preview</h2>
        <div style={{ width: 60 }} />
      </div>

      <div style={styles.heroCard}>
        <p style={styles.heroIcon}>💬</p>
        <p style={styles.heroName}>{preview.chatName}</p>
        <p style={styles.heroType}>{preview.chatType}</p>
      </div>

      <div style={styles.detailsCard}>
        <div style={styles.row}>
          <span style={styles.rowLabel}>Messages</span>
          <span style={styles.rowValue}>{preview.messageCount.toLocaleString()}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>Size</span>
          <span style={styles.rowValue}>{formatBytes(preview.sizeBytes)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.rowLabel}>Backed up</span>
          <span style={styles.rowValue}>{formatDate(preview.createdAt)}</span>
        </div>
        {preview.cid && (
          <div style={styles.row}>
            <span style={styles.rowLabel}>CID</span>
            <span style={{ ...styles.rowValue, ...styles.cid }}>{preview.cid}</span>
          </div>
        )}
      </div>

      {preview.cid && (
        <button
          style={{ ...styles.downloadBtn, opacity: downloadLoading ? 0.7 : 1 }}
          disabled={downloadLoading}
          onClick={handleDownload}
        >
          {downloadLoading ? 'Opening…' : 'Download from Storacha Gateway'}
        </button>
      )}

      <p style={styles.note}>
        Your backup is encrypted and stored on Storacha's decentralized network.
        Only you can decrypt it with your private key.
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
    marginBottom: 20,
  },
  navBackBtn: {
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
    gap: 12,
    padding: 24,
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
  errorEmoji: {
    fontSize: 44,
  },
  error: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
  },
  backBtn: {
    padding: '10px 24px',
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  heroCard: {
    textAlign: 'center',
    padding: '24px 20px',
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 16,
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 48,
    margin: '0 0 8px',
  },
  heroName: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 4px',
  },
  heroType: {
    fontSize: 13,
    opacity: 0.6,
    textTransform: 'capitalize',
    margin: 0,
  },
  detailsCard: {
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 12,
    padding: '8px 14px',
    marginBottom: 20,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  rowLabel: {
    fontSize: 13,
    opacity: 0.65,
    flexShrink: 0,
    marginRight: 12,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'right',
  },
  cid: {
    fontFamily: 'monospace',
    fontSize: 11,
    wordBreak: 'break-all',
    maxWidth: '70%',
  },
  downloadBtn: {
    width: '100%',
    padding: 14,
    background: '#34c759',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 16,
  },
  note: {
    fontSize: 12,
    opacity: 0.55,
    textAlign: 'center',
    lineHeight: 1.5,
  },
}
