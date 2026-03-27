import { Router } from 'express'
import { telegramAuthMiddleware } from '../auth.js'
import { getLeaderboard, getUserByTelegramId, addPoints, getDb } from '../db.js'

const router: import("express").IRouter = Router()

const TASK_POINTS: Record<string, number> = {
  follow_x: 50,
  join_discord: 50,
  invite_friend: 100,
  share_backup: 25,
}

// Tier definitions
const TIERS = [
  { name: 'Bronze', minPoints: 0, color: '#cd7f32' },
  { name: 'Silver', minPoints: 500, color: '#c0c0c0' },
  { name: 'Gold', minPoints: 2000, color: '#ffd700' },
  { name: 'Platinum', minPoints: 10000, color: '#e5e4e2' },
  { name: 'Diamond', minPoints: 50000, color: '#b9f2ff' },
]

function getTier(points: number): { name: string; color: string; minPoints: number } {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPoints) return TIERS[i]
  }
  return TIERS[0]
}

function getNextTier(points: number): { name: string; color: string; minPoints: number; pointsNeeded: number } | null {
  for (const tier of TIERS) {
    if (points < tier.minPoints) {
      return { ...tier, pointsNeeded: tier.minPoints - points }
    }
  }
  return null
}

/**
 * GET /api/gamification/leaderboard
 * Returns top 10 users ranked by points (public)
 */
router.get('/leaderboard', async (req: any, res: any) => {
  try {
    const leaders = getLeaderboard(10)

    res.json({
      leaderboard: leaders.map((u: any, i: number) => ({
        rank: i + 1,
        telegramId: u.telegram_id,
        firstName: u.first_name,
        username: u.username,
        points: u.points,
        totalBytesUploaded: u.total_bytes_uploaded,
        plan: u.plan,
      })),
    })
  } catch (err) {
    console.error('Leaderboard error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/gamification/points
 * Returns current user's points and rank (requires auth)
 */
router.get('/points', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const rankRow = getDb().prepare(
      'SELECT COUNT(*) as rank FROM users WHERE points > ?'
    ).get(user.points) as any

    const rank = (rankRow?.rank ?? 0) + 1

    res.json({
      points: user.points,
      rank,
      totalBytesUploaded: user.total_bytes_uploaded,
      plan: user.plan,
      tier: getTier(user.points),
      nextTier: getNextTier(user.points),
    })
  } catch (err) {
    console.error('Get points error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/gamification/tasks
 * Returns social tasks for the current user (requires auth)
 */
router.get('/tasks', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const completedRows = getDb().prepare(
      'SELECT * FROM social_tasks WHERE user_id = ?'
    ).all(user.id) as any[]

    const completedMap = new Map(completedRows.map((t: any) => [t.task_type, t]))

    const tasks = Object.keys(TASK_POINTS).map(taskType => {
      const completed = completedMap.get(taskType)
      return {
        taskType,
        completed: !!completed?.completed,
        pointsAwarded: TASK_POINTS[taskType],
        completedAt: completed?.completed_at || null,
      }
    })

    res.json({ tasks })
  } catch (err) {
    console.error('Get tasks error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/gamification/tasks/:taskType/complete
 * Marks a task as complete and awards points (requires auth)
 */
router.post('/tasks/:taskType/complete', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const { taskType } = req.params

    if (!TASK_POINTS[taskType]) {
      return res.status(400).json({ error: 'Unknown task type' })
    }

    const database = getDb()

    const existing = database.prepare(
      'SELECT * FROM social_tasks WHERE user_id = ? AND task_type = ?'
    ).get(user.id, taskType) as any

    if (existing?.completed) {
      return res.status(409).json({ error: 'Task already completed' })
    }

    const points = TASK_POINTS[taskType]

    database.prepare(`
      INSERT INTO social_tasks (user_id, task_type, completed, points_awarded, completed_at)
      VALUES (?, ?, 1, ?, datetime('now'))
      ON CONFLICT(user_id, task_type) DO UPDATE SET
        completed = 1,
        points_awarded = excluded.points_awarded,
        completed_at = datetime('now')
    `).run(user.id, taskType, points)

    addPoints(user.id, points, `task_${taskType}`, `Completed task: ${taskType}`)

    res.json({
      success: true,
      taskType,
      pointsAwarded: points,
    })
  } catch (err) {
    console.error('Complete task error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/gamification/points-history
 * Returns points history for the authenticated user
 */
router.get('/points-history', telegramAuthMiddleware, async (req: any, res: any) => {
  try {
    const user = getUserByTelegramId(req.telegramUser.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100)
    const history = getDb().prepare(`
      SELECT * FROM points_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(user.id, limit) as any[]

    res.json({
      history: history.map((h: any) => ({
        id: h.id,
        action: h.action,
        pointsDelta: h.points_delta,
        description: h.description,
        createdAt: h.created_at,
      })),
      totalPoints: user.points,
    })
  } catch (err) {
    console.error('Points history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
