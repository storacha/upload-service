export interface NoticeConfig {
  text: string
  href: string
  displayUntil: string
  dismissible?: boolean
  enabled?: boolean
}

// Configure this for marketing campaigns.
export const noticeConfig: NoticeConfig = {
  text: 'Partnership Campaign - XENEA Wallet Event Code For Gems: STORA2',
  href: 'https://xenea.app/register/6q8PVmdUA2',
  displayUntil: "2025-10-31",
  dismissible: false,
  enabled: true,
}
