export interface NoticeConfig {
 text: string
 href: string
 displayUntil: string
 dismissible?: boolean
 enabled?: boolean
}

export const noticeConfig: NoticeConfig = {
 text: process.env.NEXT_PUBLIC_NOTICE_TEXT || 'Participate in Xenea x Storacha quest and win rewards. Code: STORA-2 <u>LEARN MORE</u>',
 href: process.env.NEXT_PUBLIC_NOTICE_HREF || 'https://app.galxe.com/quest/storacha',
 displayUntil: process.env.NEXT_PUBLIC_NOTICE_DISPLAY_UNTIL || '2025-09-08',
 dismissible: process.env.NEXT_PUBLIC_NOTICE_DISMISSIBLE !== 'false',
 enabled: process.env.NEXT_PUBLIC_NOTICE_ENABLED !== 'false',
}

// Alternative notice configs for different scenarios
export const noticeConfigs = {
 referrals: {
   text: 'EARN RACHA POINTS AND STORAGE CREDITS BY REFERRING FRIENDS <u>LEARN MORE</u>',
   href: '/settings',
   displayUntil: '2025-12-31',
   dismissible: true,
 },
 maintenance: {
   text: 'SCHEDULED MAINTENANCE: SOME FEATURES MAY BE TEMPORARILY UNAVAILABLE <u>STATUS PAGE</u>',
   href: 'https://status.storacha.network',
   displayUntil: '2025-01-31',
   dismissible: false,
 },
 newFeatures: {
   text: 'NEW: PRIVATE SPACES NOW AVAILABLE - ENCRYPT YOUR DATA LOCALLY <u>LEARN MORE</u>',
   href: '/space/create',
   displayUntil: '2025-03-31',
   dismissible: true,
 },
} as const

