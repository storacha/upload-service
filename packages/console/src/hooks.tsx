import { Account, DID, PlanGetSuccess, PlanSetSuccess, PlanSetFailure, Result } from '@storacha/ui-react'
import useSWR, { SWRResponse } from 'swr'
import { logAndCaptureError } from './sentry'

/**
 * calculate the cache key for a plan's account
 */
const planKey = (account: Account) => account ? `/plan/${account.did()}` : undefined

type UsePlanResult = SWRResponse<PlanGetSuccess | undefined> & {
  setPlan: (plan: DID) => Promise<Result<PlanSetSuccess, PlanSetFailure>>
}

export const usePlan = (account: Account) => {
  const result = useSWR(planKey(account), {
    fetcher: async () => {
      console.log(`Loading plan for account ${account.toEmail()}...`)
      const result = await account.plan.get()
      if (result && result.error) {
        console.log(`Failed to get plan: ${result.error.toString()}`)
        return result.error
      }
      return result.ok
    },
    onError: logAndCaptureError
  })
  
  // @ts-ignore it's important to assign this into the existing object
  // to avoid calling the getters in SWRResponse when copying values over -
  // I can't think of a cleaner way to do this but open to refactoring
  result.setPlan = async (plan: DID) => {
    const setResult = await account.plan.set(plan)
    await result.mutate()
    return setResult
  }
  return result as UsePlanResult
}
