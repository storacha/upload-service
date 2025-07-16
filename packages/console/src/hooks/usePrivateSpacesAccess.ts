import { useW3 } from '@storacha/ui-react'
import { useState, useEffect } from 'react'
import { usePlan } from '@/hooks'

export const usePrivateSpacesAccess = () => {
  const [{ accounts }] = useW3()
  const account = accounts[0]
  
  const { data: plan, error: planError } = usePlan(account)
  const email = account?.toEmail()
  const [isPaidUser, setIsPaidUser] = useState<boolean>(false)
  
  // Check if private spaces feature is enabled via environment variable
  const isPrivateSpacesEnabled = process.env.NEXT_PUBLIC_PRIVATE_SPACES_ENABLED === 'true'
  // Get allowed domains from environment variable
  const allowedDomains = process.env.NEXT_PUBLIC_PRIVATE_SPACES_DOMAINS?.split(',') 
  || ['dmail.ai', 'storacha.network']
  
  useEffect(() => {
    const isStorachaUser = email?.endsWith('@storacha.network')
    if (isStorachaUser) {
      // Assume paid user for testing private spaces
      setIsPaidUser(true) 
    } else if (plan) {
      // Check user's plan to determine if they are a paid or not
      const isPaid = plan.product !== 'did:web:starter.web3.storage' && plan.product !== 'did:web:free.web3.storage'
      setIsPaidUser(isPaid)
    } else {
       // Set as free plan by default
      setIsPaidUser(false)
    }
  }, [plan, planError, email])
  
  // If private spaces feature is disabled, return values that hide all private spaces functionality
  if (!isPrivateSpacesEnabled) {
    return {
      canAccessPrivateSpaces: false,
      shouldShowUpgradePrompt: false,
      shouldShowPrivateSpacesTab: false,
      isEligibleDomain: false,
      isPaidUser,
      email,
      plan,
      planLoading: !plan && !planError
    }
  }

  // Check if user's email domain is in the allowed domains list
  const isEligibleDomain = allowedDomains.some(domain => email?.endsWith(`@${domain}`))
  return {
    canAccessPrivateSpaces: isEligibleDomain && isPaidUser,
    shouldShowUpgradePrompt: isEligibleDomain && !isPaidUser,
    shouldShowPrivateSpacesTab: isEligibleDomain,
    isEligibleDomain,
    isPaidUser,
    email,
    plan,
    planLoading: !plan && !planError // Loading if we don't have plan data and no error
  }
}
