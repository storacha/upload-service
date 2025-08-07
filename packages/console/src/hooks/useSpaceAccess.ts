import { useW3 } from '@storacha/ui-react'
import { useMemo } from 'react'
import { usePrivateSpacesAccess } from './usePrivateSpacesAccess'

/**
 * Checks if a user has access to a private space.
 * 
 * @param spaceDID - The DID of the space to check access for.
 * @returns An object containing the space, whether it is private, whether the user has access, and whether the space is loading.
 */
export const useSpaceAccess = (spaceDID: string) => {
  const [{ spaces }] = useW3()
  
  const space = useMemo(() => 
    spaces.find(s => s.did() === spaceDID),
    [spaces, spaceDID]
  )
  
  // Check if the space is private
  const isPrivate = useMemo(() => {
    if (!space) return false
    return space.access.type === 'private'
  }, [space])
  
  // Get user's private space access status
  const { canAccessPrivateSpaces, planLoading } = usePrivateSpacesAccess()
  
  // Check if current user has access to the space
  const hasAccess = useMemo(() => {
    if (!space) return false
    
    // If space is not private, user can access it
    if (!isPrivate) return true
    
    // If space is private, check if user has paid plan
    if (canAccessPrivateSpaces) {
      return true
    }
    
    return false
  }, [space, isPrivate, canAccessPrivateSpaces])
  
  return {
    space,
    isPrivate,
    hasAccess,
    isLoading: !space || planLoading
  }
}
