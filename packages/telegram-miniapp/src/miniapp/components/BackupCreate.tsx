import React, { useState } from 'react'
import type { UserProfile } from '../api.js'
import { createBackup, getMe } from '../api.js'

interface Props {
  user: UserProfile | null
  onSuccess: (updatedUser: UserProfile) => void
  onBack: () => void
}

type ChatType = 'private' | 'group' | 'channel' | 'supergroup'

export default function BackupCreate({ onSuccess, onBack }: Props) {
  const [chatId, setChatId] = useState('')
  const [chatName, setChatName] = useState('')
  const [chatType, setChatType] = useState<ChatType>('private')
  const [messagesJson, setMessagesJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    let messages: any[]
    try {
      messages = JSON.parse(messagesJson)
      if (!Array.isArray(messages)) throw new Error('Messages must be a JSON array')
    } catch {
      setError('Invalid JSON format for messages. Please provide a valid JSON array.')
      return
    }

    setLoading(true)
    try {
      const result = await createBackup(chatId, chatName, chatType, messages)
      setSuccess(`Backup created! Earned ${result.pointsEarned} points. CID: ${result.cid}`)
      const updated = await getMe()
      onSuccess(updated)
    } catch (err: any) {
      setError(err.message || 'Backup creation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <h2 style={styles.title}>New Backup</h2>
        <div style={{ width: 60 }} />
      </div>

      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>How to backup a chat</p>
        <p style={styles.infoText}>
          Export your Telegram chat using Telegram Desktop (Settings → Advanced → Export data),
          then paste the messages JSON here. Your data is encrypted before upload.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Chat ID</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. -100123456789"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            required
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Chat Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. My Group Chat"
            value={chatName}
            onChange={e => setChatName(e.target.value)}
            required
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Chat Type</label>
          <select
            style={styles.input}
            value={chatType}
            onChange={e => setChatType(e.target.value as ChatType)}
          >
            <option value="private">Private</option>
            <option value="group">Group</option>
            <option value="channel">Channel</option>
            <option value="supergroup">Supergroup</option>
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Messages (JSON array)</label>
          <p style={styles.fieldHint}>
            Paste messages as a JSON array. Each message should have: id, date (unix timestamp),
            sender_name, from_self (boolean), text.
          </p>
          <textarea
            style={styles.textarea}
            placeholder={'[\n  {\n    "id": 1,\n    "date": 1700000000,\n    "sender_name": "Alice",\n    "from_self": false,\n    "text": "Hello!"\n  }\n]'}
            value={messagesJson}
            onChange={e => setMessagesJson(e.target.value)}
            required
            rows={8}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.successMsg}>{success}</p>}

        <button
          type="submit"
          style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
          disabled={loading}
        >
          {loading ? 'Creating backup…' : 'Create Backup'}
        </button>
      </form>
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
  infoBox: {
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 1.5,
    opacity: 0.75,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    opacity: 0.8,
  },
  fieldHint: {
    fontSize: 11,
    opacity: 0.6,
    margin: 0,
    lineHeight: 1.4,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    color: 'var(--tg-theme-text-color, #000000)',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    color: 'var(--tg-theme-text-color, #000000)',
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    color: '#ff3b30',
    fontSize: 13,
    padding: '8px 12px',
    background: '#fff2f2',
    borderRadius: 8,
  },
  successMsg: {
    color: '#155724',
    fontSize: 13,
    padding: '8px 12px',
    background: '#d4edda',
    borderRadius: 8,
    wordBreak: 'break-all',
  },
  submitBtn: {
    padding: '14px',
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
}
