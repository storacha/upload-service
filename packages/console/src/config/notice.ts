export interface NoticeConfig {
  text: string
  href: string
  displayUntil: string
  dismissible?: boolean
  enabled?: boolean
}

// Configure this for marketing campaigns.
export const noticeConfig: NoticeConfig = {
  text:
    'Partnership Campaign - XENEA Wallet Event Code For Gems: STORA2',
  href: "",
  displayUntil: "2025-09-21",
  dismissible: false,
  enabled: true,
}
