export interface NoticeConfig {
  text: string
  href: string
  displayUntil: string
  dismissible?: boolean
  enabled?: boolean
}

export const noticeConfig: NoticeConfig = {
  text:
    process.env.NEXT_PUBLIC_NOTICE_TEXT ||
    'EARN RACHA POINTS AND STORAGE CREDITS BY REFERRING FRIENDS. <u>LEARN MORE</u>',
  href: process.env.NEXT_PUBLIC_NOTICE_HREF || 'https://storacha.network/referrals',
  displayUntil: process.env.NEXT_PUBLIC_NOTICE_DISPLAY_UNTIL || '2025-12-31',
  dismissible: process.env.NEXT_PUBLIC_NOTICE_DISMISSIBLE !== 'false',
  enabled: process.env.NEXT_PUBLIC_NOTICE_ENABLED === 'true',
}
