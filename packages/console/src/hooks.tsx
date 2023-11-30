import { Account, PlanGetSuccess } from '@w3ui/react'
import useSWR from 'swr'

export const usePlan = (account: Account) =>
  useSWR<PlanGetSuccess | undefined>(`/plan/${account?.did() ?? ''}`, {
    fetcher: async () => {
      if (!account) return
      const result = await account.plan.get()
      if (result.error) throw new Error('getting plan', { cause: result.error })
      return result.ok
    },
    onError: err => console.error(err.message, err.cause)
  })