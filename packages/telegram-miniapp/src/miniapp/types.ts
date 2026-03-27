export interface User {
  id: number
  telegramId: number
  firstName: string
  lastName?: string
  username?: string
  points: number
  totalBytesUploaded: number
  plan: 'free' | 'pro'
  humanodeVerified: boolean
  storachaDid?: string
}

export interface Backup {
  id: number
  chatId: string
  chatName: string
  chatType: 'private' | 'group' | 'channel' | 'supergroup'
  cid?: string
  sizeBytes: number
  messageCount: number
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export interface LeaderboardEntry {
  telegramId: number
  firstName: string
  username?: string
  points: number
  totalBytesUploaded: number
  plan: string
}

export interface Task {
  taskType: string
  completed: boolean
  pointsAwarded: number
  completedAt?: string
}
