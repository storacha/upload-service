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
  
  const { data: plan, isLoading } = usePlan(account, planOptions)
  const email = account?.toEmail()
  
  // Get allowed domains from environment variable
  const allowedDomains = useMemo(() => 
    process.env.NEXT_PUBLIC_PRIVATE_SPACES_DOMAINS?.split(',') || 
    ['dmail.ai', 'storacha.network']
  , [])
  
  // Check if user is a Storacha user (always has access)
  const isStorachaUser = useMemo(() => 
    email?.endsWith('@storacha.network') ?? false
  , [email])
  
  // Check if user has a paid plan
  const isPaidUser = useMemo(() => {
    if (isStorachaUser) return true
    if (!plan?.product) return false
    return plan.product === PLANS.lite || 
           plan.product === PLANS.business
  }, [plan, isStorachaUser])
  
  // Check if user's email domain is in the allowed domains list
  const isEligibleDomain = useMemo(() => 
    email ? allowedDomains.some(domain => email.endsWith(`@${domain}`)) : false
  , [email, allowedDomains])
  
  // Debug logging
  const debugInfo = useCallback(() => ({
    email,
    isStorachaUser,
    isPaidUser,
    isEligibleDomain,
    plan: plan?.product,
    planLoading: isLoading
  }), [email, isStorachaUser, isPaidUser, isEligibleDomain, plan, isLoading])
  
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMemo(() => {
      console.debug('Private spaces access debug:', debugInfo())
    }, [debugInfo])
  }
  
  return {
    canAccessPrivateSpaces: isEligibleDomain && isPaidUser,
    shouldShowUpgradePrompt: isEligibleDomain && !isPaidUser && !isStorachaUser,
    shouldShowPrivateSpacesTab: isEligibleDomain,
    email,
    plan,
    planLoading: isLoading,
    debugInfo // Export for debugging
  }
}
