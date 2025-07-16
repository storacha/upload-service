import { useW3 } from '@storacha/ui-react'
import { useState, useEffect } from 'react'
import { usePlan } from '@/hooks'

export const usePrivateSpacesAccess = () => {
  const [{ accounts }] = useW3()
  const account = accounts[0]
  
  const { data: plan, error: planError } = usePlan(account)
  const email = account?.toEmail()
  const [isPaidUser, setIsPaidUser] = useState<boolean>(false)
  
  // Fetch plan information
  useEffect(() => {
    if (plan) {
      console.log('Plan', plan)
      const isPaid = plan.product !== 'did:web:starter.web3.storage' && plan.product !== 'did:web:free.web3.storage'
      console.log('Is paid user', isPaid)
      setIsPaidUser(isPaid)
    } else if (planError) {
      console.log('Plan API error:', planError)
      // Temporary fallback: if plan API is failing, assume eligible users with @storacha.network emails are paid users
      // This is a temporary workaround for staging environment issues
      const isStorachaUser = email?.endsWith('@storacha.network')
      if (isStorachaUser) {
        console.log('Plan API failing but user is @storacha.network, assuming paid user for testing')
        setIsPaidUser(true)
      }
    }
  }, [plan, planError, email])
  
  const isDmailUser = email?.endsWith('@dmail.ai')
  const isStorachaUser = email?.endsWith('@storacha.network')
  const isEligibleDomain = isDmailUser || isStorachaUser
  
  // Debug logging
  console.log('=== Private Spaces Access Debug ===')
  console.log('Email:', email)
  console.log('Plan:', plan)
  console.log('Plan Error:', planError)
  console.log('isDmailUser:', isDmailUser)
  console.log('isStorachaUser:', isStorachaUser)
  console.log('isEligibleDomain:', isEligibleDomain)
  console.log('isPaidUser:', isPaidUser)
  console.log('canAccessPrivateSpaces:', isEligibleDomain && isPaidUser)
  console.log('shouldShowUpgradePrompt:', isEligibleDomain && !isPaidUser)
  console.log('===================================')
  
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
