export interface SpaceWithAccessType {
  accessType?: 'public' | 'private'
  // ... other space properties from @storacha/ui-react Space interface
}

export interface PrivateSpacesFeatureFlags {
  canAccessPrivateSpaces: boolean
  shouldShowUpgradePrompt: boolean
  shouldShowPrivateSpacesTab: boolean
  isEligibleDomain: boolean
  isPaidUser: boolean
  email?: string
  plan?: string
  planLoading: boolean
}

export interface SpaceCreationOptions {
  accessType?: 'public' | 'private'
  name: string
}

export interface FeatureFlags {
  isPrivateSpacesEnabled: boolean
  isUserInAllowedDomains: boolean
  canSeePrivateSpacesFeature: boolean
}

export type SpaceType = 'public' | 'private'

export interface FilteredSpaces {
  publicSpaces: any[] // Will be Space[] from @storacha/ui-react when available
  privateSpaces: any[] // Will be Space[] from @storacha/ui-react when available
  hiddenPrivateSpaces: any[] // For debugging/admin purposes
  hasHiddenPrivateSpaces: boolean
}
