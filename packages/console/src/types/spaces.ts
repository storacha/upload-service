export interface SpaceWithAccessType {
  accessType?: 'public' | 'private'
  // ... other space properties from @storacha/ui-react Space interface
}

export interface SpaceCreationOptions {
  accessType?: 'public' | 'private'
  name: string
}

export type SpaceType = 'public' | 'private'

export interface FilteredSpaces {
  publicSpaces: any[] // Will be Space[] from @storacha/ui-react when available
  privateSpaces: any[] // Will be Space[] from @storacha/ui-react when available
  hiddenPrivateSpaces: any[] // For debugging/admin purposes
  hasHiddenPrivateSpaces: boolean
}
