import { Account, DID, PlanGetSuccess, PlanSetSuccess, PlanSetFailure, Result } from '@w3ui/react'
import useSWR, { SWRResponse, useSWRConfig } from 'swr'

/**
 * calculate the cache key for a plan's account
 */
const planKey = (account: Account) => account ? `/plan/${account.did()}` : undefined

type UsePlanResult = SWRResponse<PlanGetSuccess | undefined> & {
  setPlan: (plan: DID) => Promise<Result<PlanSetSuccess, PlanSetFailure>>
}

export const usePlan = (account: Account) => {
  const result = useSWR<PlanGetSuccess | undefined>(planKey(account), {
    fetcher: async () => {
      if (!account) return
      const result = await account.plan.get()
      if (result.error) throw new Error('getting plan', { cause: result.error })
      return result.ok
    },
    onError: err => console.error(err.message, err.cause)
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
