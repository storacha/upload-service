/**
 * API client for the Storacha Telegram Mini App backend
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
            photo_url?: string
          }
          auth_date: number
          hash: string
          start_param?: string
        }
        ready(): void
        expand(): void
        close(): void
        showAlert(message: string): void
        showConfirm(message: string, callback: (confirmed: boolean) => void): void
        MainButton: {
          text: string
          color: string
          textColor: string
          isVisible: boolean
          isActive: boolean
          show(): void
          hide(): void
          enable(): void
          disable(): void
          onClick(fn: () => void): void
          offClick(fn: () => void): void
        }
        BackButton: {
          isVisible: boolean
          show(): void
          hide(): void
          onClick(fn: () => void): void
          offClick(fn: () => void): void
        }
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
          secondary_bg_color?: string
        }
        colorScheme: 'light' | 'dark'
        viewportHeight: number
        viewportStableHeight: number
        isExpanded: boolean
        platform: string
        version: string
      }
    }
  }
}

const BASE_URL = '/api'

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || ''
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = getInitData()
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(err.error || `Request failed: ${response.status}`)
  }

  return response.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface UserProfile {
  telegramId: number
  firstName: string
  lastName?: string
  username?: string
  storachaDid: string
  points: number
  totalBytesUploaded: number
  plan: 'free' | 'pro'
  humanodeVerified: boolean
  createdAt?: string
}

export async function login(): Promise<{ success: boolean; user: UserProfile }> {
  return apiFetch('/auth/login', { method: 'POST' })
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch('/auth/me')
}

export async function verifyHumanode(token: string): Promise<{ success: boolean; verified: boolean }> {
  return apiFetch('/auth/humanode-verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

// ── Backups ───────────────────────────────────────────────────────────────────

export interface Backup {
  id: number
  chatId: string
  chatName: string
  chatType: string
  cid?: string
  sizeBytes: number
  messageCount: number
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export interface Message {
  id: number
  date: number
  sender_name: string
  from_self: boolean
  text: string
}

export async function listBackups(): Promise<{ backups: Backup[] }> {
  return apiFetch('/backup/list')
}

export async function createBackup(
  chatId: string,
  chatName: string,
  chatType: string,
  messages: Message[]
): Promise<{
  success: boolean
  backupId: number
  cid: string
  sizeBytes: number
  messageCount: number
  pointsEarned: number
}> {
  return apiFetch('/backup/create', {
    method: 'POST',
    body: JSON.stringify({ chatId, chatName, chatType, messages }),
  })
}

export async function deleteBackup(backupId: number): Promise<{ success: boolean; pointsDeducted: number }> {
  return apiFetch(`/backup/${backupId}`, { method: 'DELETE' })
}

export async function getBackupDownload(backupId: number): Promise<{
  downloadUrl: string
  cid: string
  chatName: string
  sizeBytes: number
}> {
  return apiFetch(`/backup/${backupId}/download`)
}

export async function getBackupPreview(backupId: number): Promise<{
  id: number
  chatName: string
  chatType: string
  messageCount: number
  sizeBytes: number
  createdAt: string
  cid: string
}> {
  return apiFetch(`/backup/${backupId}/preview`)
}

// ── Gamification ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  telegramId: number
  firstName: string
  username?: string
  points: number
  totalBytesUploaded: number
  plan: string
  tier: { name: string; color: string; minPoints: number }
}

export interface Tier {
  name: string
  color: string
  minPoints: number
}

export interface PointsHistory {
  id: number
  action: string
  pointsDelta: number
  description?: string
  createdAt: string
}

export async function getLeaderboard(limit = 10): Promise<{
  leaderboard: LeaderboardEntry[]
  currentUserRank: number | null
}> {
  return apiFetch(`/gamification/leaderboard?limit=${limit}`)
}

export async function getPointsHistory(limit = 20): Promise<{
  history: PointsHistory[]
  totalPoints: number
  tier: Tier
  nextTier: (Tier & { pointsNeeded: number }) | null
}> {
  return apiFetch(`/gamification/points-history?limit=${limit}`)
}

export async function getStats(): Promise<{
  points: number
  rank: number
  tier: Tier
  nextTier: (Tier & { pointsNeeded: number }) | null
  totalBytesUploaded: number
  backupCount: number
  plan: string
  socialTasks: Array<{ taskType: string; completed: boolean; pointsAwarded: number }>
}> {
  return apiFetch('/gamification/stats')
}

export async function completeSocialTask(taskType: string): Promise<{ success: boolean; pointsAwarded: number; taskType: string }> {
  return apiFetch('/gamification/social-task', {
    method: 'POST',
    body: JSON.stringify({ taskType }),
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp
}

// ── Spec-compatible aliases ────────────────────────────────────────────────────

export async function getBackups(): Promise<{ backups: Backup[] }> {
  return listBackups()
}

export async function downloadBackup(id: number): Promise<{
  downloadUrl: string
  cid: string
  chatName: string
  sizeBytes: number
}> {
  return getBackupDownload(id)
}

export interface Task {
  taskType: string
  completed: boolean
  pointsAwarded: number
  completedAt?: string | null
}

export async function getPoints(): Promise<{
  points: number
  rank: number
  totalBytesUploaded: number
  plan: string
  tier: { name: string; color: string }
  nextTier: { name: string; pointsNeeded: number } | null
}> {
  return apiFetch('/gamification/points')
}

export async function getTasks(): Promise<{ tasks: Task[] }> {
  return apiFetch('/gamification/tasks')
}

export async function completeTask(taskType: string): Promise<{ success: boolean; taskType: string; pointsAwarded: number }> {
  return apiFetch(`/gamification/tasks/${taskType}/complete`, { method: 'POST' })
}
