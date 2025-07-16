import { useW3 } from '@storacha/ui-react'
import { usePrivateSpacesAccess } from './usePrivateSpacesAccess'

export const useFilteredSpaces = () => {
  const [{ spaces }] = useW3()
  const { canAccessPrivateSpaces } = usePrivateSpacesAccess()
  // Filter spaces based on accessType
  // Note: accessType might not be available yet until backend is updated
  const allPublicSpaces = spaces.filter(s => s.access.type !== 'private')
  const allPrivateSpaces = spaces.filter(s => s.access.type === 'private')
  // Hide but preserve: private spaces are hidden when user loses access
  // but they're still in the backend and will reappear if user upgrades
  const visiblePrivateSpaces = canAccessPrivateSpaces ? allPrivateSpaces : []
  const hiddenPrivateSpaces = canAccessPrivateSpaces ? [] : allPrivateSpaces
  return {
    publicSpaces: allPublicSpaces,
    privateSpaces: visiblePrivateSpaces,
    hiddenPrivateSpaces, // For debugging/admin purposes
    hasHiddenPrivateSpaces: hiddenPrivateSpaces.length > 0
  }
}
