import React, { useEffect, useState } from 'react'
import type { UserProfile, LeaderboardEntry } from '../api.js'
import { getLeaderboard, formatBytes } from '../api.js'

interface Props {
  user: UserProfile | null
  onBack: () => void
}

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Leaderboard({ user, onBack }: Props) {
  const [entries, setEntries] = useState<(LeaderboardEntry & { rank: number })[]>([])
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await getLeaderboard()
        setEntries(result.leaderboard)
        setCurrentUserRank(result.currentUserRank ?? null)
      } catch (err: any) {
        setError(err.message || 'Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isCurrentUser = (entry: LeaderboardEntry) =>
    user && entry.telegramId === user.telegramId

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.hint}>Loading leaderboard…</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <h2 style={styles.title}>Leaderboard</h2>
        <div style={{ width: 60 }} />
      </div>

      {currentUserRank && (
        <div style={styles.rankBanner}>
          <span style={styles.rankBannerText}>Your rank: #{currentUserRank}</span>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.list}>
        {entries.map((entry, idx) => {
          const rank = entry.rank ?? (idx + 1)
          const isSelf = isCurrentUser(entry)
          return (
            <div
              key={entry.telegramId}
              style={{
                ...styles.item,
                ...(isSelf ? styles.selfItem : {}),
              }}
            >
              <div style={styles.rankCol}>
                {RANK_MEDALS[rank] ? (
                  <span style={styles.medal}>{RANK_MEDALS[rank]}</span>
                ) : (
                  <span style={styles.rankNum}>#{rank}</span>
                )}
              </div>
              <div style={styles.nameCol}>
                <p style={styles.name}>
                  {entry.username ? `@${entry.username}` : entry.firstName}
                  {isSelf && <span style={styles.youTag}> (you)</span>}
                </p>
                <p style={styles.meta}>{formatBytes(entry.totalBytesUploaded)} uploaded</p>
              </div>
              <div style={styles.pointsCol}>
                <p style={styles.points}>{entry.points.toLocaleString()}</p>
                <span style={{ ...styles.planBadge, ...(entry.plan === 'pro' ? styles.proBadge : styles.freeBadge) }}>
                  {entry.plan}
                </span>
              </div>
            </div>
          )
        })}

        {entries.length === 0 && !error && (
          <p style={styles.empty}>No entries yet. Be the first!</p>
        )}
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
  rankBanner: {
    background: 'var(--tg-theme-button-color, #007aff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 16,
    textAlign: 'center',
  },
  rankBannerText: {
    fontSize: 15,
    fontWeight: 600,
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
    marginBottom: 12,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  selfItem: {
    border: '2px solid var(--tg-theme-button-color, #007aff)',
    background: 'rgba(0, 122, 255, 0.08)',
  },
  rankCol: {
    width: 36,
    flexShrink: 0,
    textAlign: 'center',
  },
  medal: {
    fontSize: 22,
  },
  rankNum: {
    fontSize: 14,
    fontWeight: 700,
    opacity: 0.7,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  youTag: {
    fontWeight: 400,
    opacity: 0.7,
    fontSize: 12,
  },
  meta: {
    fontSize: 11,
    opacity: 0.55,
    margin: '2px 0 0',
  },
  pointsCol: {
    textAlign: 'right',
    flexShrink: 0,
  },
  points: {
    fontSize: 15,
    fontWeight: 700,
    margin: '0 0 3px',
  },
  planBadge: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 20,
    fontWeight: 600,
  },
  freeBadge: {
    background: '#e0e0e0',
    color: '#555',
  },
  proBadge: {
    background: '#ffd700',
    color: '#7a5c00',
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    opacity: 0.6,
    fontSize: 14,
  },
}
