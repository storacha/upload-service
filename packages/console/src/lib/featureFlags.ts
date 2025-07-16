export const FEATURE_FLAGS = {
  PRIVATE_SPACES_ENABLED: process.env.NEXT_PUBLIC_PRIVATE_SPACES_ENABLED === 'true',
  PRIVATE_SPACES_ALLOWED_DOMAINS: process.env.NEXT_PUBLIC_PRIVATE_SPACES_DOMAINS?.split(',') || ['dmail.ai', 'storacha.network']
} as const

export const useFeatureFlags = () => {
  // Import here to avoid circular dependency
  const { usePrivateSpacesAccess } = require('../hooks/usePrivateSpacesAccess')
  const { email } = usePrivateSpacesAccess()

  const isPrivateSpacesEnabled = FEATURE_FLAGS.PRIVATE_SPACES_ENABLED
  const isUserInAllowedDomains = FEATURE_FLAGS.PRIVATE_SPACES_ALLOWED_DOMAINS.some(domain =>
    email?.endsWith(`@${domain}`)
  )

  return {
    isPrivateSpacesEnabled,
    isUserInAllowedDomains,
    canSeePrivateSpacesFeature: isPrivateSpacesEnabled && isUserInAllowedDomains
  }
}
