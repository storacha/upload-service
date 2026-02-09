import { useW3 } from '@storacha/ui-react'
import { usePrivateSpacesAccess } from './usePrivateSpacesAccess'
import { sortSpaces, type SortOption } from './useSpaceSort'

export const useFilteredSpaces = (sortOption: SortOption = 'newest') => {
  const [{ spaces }] = useW3()
  const { canAccessPrivateSpaces } = usePrivateSpacesAccess()
  const allPublicSpaces = spaces.filter(s => s.access.type === 'public')
  const allPrivateSpaces = spaces.filter(s => s.access.type === 'private')
  // Hide but preserve: private spaces are hidden when user loses access
  // but they're still in the backend and will reappear if user upgrades to paid plan
  const visiblePrivateSpaces = canAccessPrivateSpaces ? allPrivateSpaces : []
  const hiddenPrivateSpaces = canAccessPrivateSpaces ? [] : allPrivateSpaces
  
  // Apply sorting to filtered spaces
  const sortedPublicSpaces = sortSpaces(allPublicSpaces, sortOption)
  const sortedPrivateSpaces = sortSpaces(visiblePrivateSpaces, sortOption)
  
  return {
    publicSpaces: sortedPublicSpaces,
    privateSpaces: sortedPrivateSpaces,
    hiddenPrivateSpaces, // For debugging/admin purposes
    hasHiddenPrivateSpaces: hiddenPrivateSpaces.length > 0
  }
}
