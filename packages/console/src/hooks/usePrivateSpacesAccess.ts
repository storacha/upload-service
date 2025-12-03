import { useW3 } from '@storacha/ui-react'
import { useCallback, useMemo } from 'react'
import { usePlan } from '@/hooks'
import { PLANS } from '@/app/plans/change/page'
import { useIframe } from '@/contexts/IframeContext'

export const usePrivateSpacesAccess = () => {
  const [{ accounts }] = useW3()
  const account = accounts[0]
  const { isIframe } = useIframe()
  
  // Use iframe-aware SWR options to prevent authentication restarts
  const planOptions = useMemo(() => ({
    revalidateOnFocus: !isIframe,
    revalidateOnReconnect: !isIframe,
    refreshInterval: isIframe ? 0 : undefined,
  }), [isIframe])
  
  const { data: plan, error: planError, isLoading } = usePlan(account, planOptions)
  const email = account?.toEmail()
  
  // Domains eligible for access to private spaces
  const allowedDomains = useMemo(() => 
    process.env.NEXT_PUBLIC_PRIVATE_SPACES_DOMAINS?.split(',') || 
    ['dmail.ai', 'storacha.network']
  , [])

  // Domains eligible for free trial access to private spaces
  const freeTrialDomains = useMemo(() => 
    process.env.NEXT_PUBLIC_PRIVATE_SPACES_FREE_TRIAL_DOMAINS?.split(',') || 
    ['storacha.network']
  , [])

  // Check if user is a free trial user (always has free access to private spaces)
  const isFreeTrialUser = useMemo(() => 
    email ? freeTrialDomains.some(domain => email.endsWith(`@${domain}`)) : false
  , [email, freeTrialDomains])

  // Check if user has a paid plan
  const isPaidUser = useMemo(() => {
    if (isFreeTrialUser) return true
    if (!plan?.product) return false
    return plan.product === PLANS.lite || 
           plan.product === PLANS.business
  }, [plan, isFreeTrialUser])
  
  // Check if user's email domain is in the allowed domains list to access private spaces
  const isEligibleDomain = useMemo(() => 
    email ? allowedDomains.some(domain => email.endsWith(`@${domain}`)) : false
  , [email, allowedDomains])
  
  // true if the plan is loading for the first time - ie, if isLoading is true and plan and error
  // are still undefined
  const planLoading = !plan && !planError && isLoading

  // Debug logging
  const debugInfo = useCallback(() => ({
    email,
    isFreeTrialUser,
    isPaidUser,
    isEligibleDomain,
    plan: plan?.product,
    planLoading
  }), [email, isFreeTrialUser, isPaidUser, isEligibleDomain, plan, isLoading])
  
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMemo(() => {
      console.debug('Private spaces access debug:', debugInfo())
    }, [debugInfo])
  }
  
  return {
    canAccessPrivateSpaces: isEligibleDomain && isPaidUser,
    shouldShowUpgradePrompt: isEligibleDomain && !isPaidUser && !isFreeTrialUser,
    shouldShowPrivateSpacesTab: isEligibleDomain,
    email,
    plan,
    planLoading,
    debugInfo // Export for debugging
  }
}
