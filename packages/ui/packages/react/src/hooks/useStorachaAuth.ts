import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useW3 } from '../providers/Provider.js'
import { useStorachaAuth } from '../components/StorachaAuth.js'

/**
 * Enhanced authentication hook that provides additional functionality
 */
export function useStorachaAuthEnhanced() {
  const [authState, authActions] = useStorachaAuth()
  const [{ client, accounts, spaces }] = useW3()
  
  const previousAuthState = useRef<boolean>(false)
  const sessionStartTime = useRef<number>(Date.now())

  // Track authentication state changes
  useEffect(() => {
    const wasAuthenticated = previousAuthState.current
    const isAuthenticated = authState.isAuthenticated

    if (!wasAuthenticated && isAuthenticated) {
      sessionStartTime.current = Date.now()
    }

    previousAuthState.current = isAuthenticated
  }, [authState.isAuthenticated])

  // Enhanced logout with session tracking
  const logoutWithTracking = useCallback(async () => {
    await authActions.logout()
  }, [authActions])

  // Get current user info
  const currentUser = useMemo(() => {
    if (!authState.isAuthenticated || accounts.length === 0) {
      return null
    }

    const account = accounts[0]
    return {
      email: account.toEmail(),
      did: client?.agent.did(),
      spaces: spaces.length,
      isAuthenticated: true
    }
  }, [authState.isAuthenticated, accounts, client, spaces])


  // Get session info
  const sessionInfo = useMemo(() => ({
    isAuthenticated: authState.isAuthenticated,
    isIframe: authState.isIframe,
    sessionDuration: authState.isAuthenticated ? Date.now() - sessionStartTime.current : 0,
    email: authState.email,
    submitted: authState.submitted
  }), [authState, sessionStartTime])

  return {
    // Original auth state and actions
    ...authState,
    ...authActions,
    
    // Enhanced functionality
    currentUser,
    sessionInfo,
    logoutWithTracking,
    
    // Convenience getters
    isAuthenticated: authState.isAuthenticated,
    isIframe: authState.isIframe,
    isLoading: !client && !authState.submitted,
    isSubmitting: authState.submitted
  }
}

