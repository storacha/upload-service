import { Bot, InlineKeyboard } from 'grammy'

export function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required')
  }

  const bot = new Bot(token)
  const appUrl = process.env.TELEGRAM_APP_URL || 'https://your-app.example.com'

  // Handle /start command
  bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .webApp('📦 Open Backup App', `${appUrl}`)

    await ctx.reply(
      `Welcome to *Storacha Chat Backup* 🔐\n\n` +
      `Securely backup your Telegram chats with end-to-end encryption using decentralized storage.\n\n` +
      `✅ *Features:*\n` +
      `• Encrypted backup of chats, groups & channels\n` +
      `• Downloadable HTML archives\n` +
      `• Earn points for every backup\n` +
      `• View loyalty rankings\n\n` +
      `Tap the button below to get started!`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    )
  })

  // Handle /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `*Storacha Chat Backup Help* 📚\n\n` +
      `*Commands:*\n` +
      `/start - Open the backup app\n` +
      `/status - Check your backup status\n` +
      `/points - View your points balance\n` +
      `/leaderboard - View top users\n\n` +
      `*How it works:*\n` +
      `1. Open the app with /start\n` +
      `2. Select chats to backup\n` +
      `3. Your chats are encrypted & stored on IPFS\n` +
      `4. Earn points for each backup\n\n` +
      `For support: @storacha_support`,
      { parse_mode: 'Markdown' }
    )
  })

  // Handle /status command
  bot.command('status', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    const keyboard = new InlineKeyboard()
      .webApp('📊 View Full Dashboard', `${appUrl}?view=dashboard`)

    await ctx.reply(
      `📊 *Your Backup Status*\n\n` +
      `Open the app to see your full backup history and manage your stored chats.`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    )
  })

  // Handle /points command
  bot.command('points', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .webApp('🏆 View Leaderboard', `${appUrl}?view=leaderboard`)

    await ctx.reply(
      `🏅 *Points System*\n\n` +
      `• Earn 1 point per 1KB uploaded\n` +
      `• Points deducted for deleted backups\n` +
      `• Top users get free storage upgrades!\n\n` +
      `Open the app to see your current points.`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    )
  })

  // Handle /leaderboard command
  bot.command('leaderboard', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .webApp('🏆 Full Leaderboard', `${appUrl}?view=leaderboard`)

    await ctx.reply(
      `🏆 *Top Backup Champions*\n\n` +
      `See who's backing up the most chats!\n` +
      `Top users earn bonus storage and premium features.`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    )
  })

  // Handle inline queries for sharing
  bot.on('inline_query', async (ctx) => {
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'backup-invite',
        title: 'Invite to Storacha Backup',
        description: 'Share the backup app with friends',
        input_message_content: {
          message_text:
            `🔐 *Storacha Chat Backup*\n\n` +
            `Backup your Telegram chats securely with end-to-end encryption!\n\n` +
            `Start here: @StorachaBackupBot`,
          parse_mode: 'Markdown',
        },
      },
    ])
  })

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err)
  })

  return bot
}
