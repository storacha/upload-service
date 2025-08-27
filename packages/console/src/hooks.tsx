import { Account, DID, PlanGetSuccess, PlanSetSuccess, PlanSetFailure, Result } from '@storacha/ui-react'
import { useState, useEffect, useRef } from 'react'
import useSWR, { SWRResponse, SWRConfiguration } from 'swr'
import { logAndCaptureError } from './sentry'
import { useIframe } from './contexts/IframeContext'

/**
 * SWR configuration that is aware of its iframe context.
 * When in an iframe, it disables all revalidation behaviors to prevent refreshes.
 */
export const useIframeAwareSWRConfig = (options?: SWRConfiguration): SWRConfiguration => {
  const { isIframe, isDetectionComplete } = useIframe()

  if (!isDetectionComplete) {
    return {
      ...options,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0
    }
  }

  return {
    ...options,
    revalidateOnFocus: !isIframe,
    revalidateOnReconnect: !isIframe,
    refreshInterval: isIframe ? 0 : options?.refreshInterval ?? 0
  }
}

/**
 * calculate the cache key for a plan's account
 */
const planKey = ({ account, isDetectionComplete }: { account: Account, isDetectionComplete: boolean }) => {
  if (!isDetectionComplete || !account) {
    return null
  }
  return `/plan/${account.did()}`
}

type UsePlanResult = SWRResponse<PlanGetSuccess | undefined> & {
  setPlan: (plan: DID) => Promise<Result<PlanSetSuccess, PlanSetFailure>>
}

export const usePlan = (account: Account, isDetectionComplete: boolean, options?: SWRConfiguration) => {
  const config = useIframeAwareSWRConfig(options)
  const result = useSWR<PlanGetSuccess | undefined>(planKey({ account, isDetectionComplete }), {
    fetcher: async () => {
      if (!account) return
      const result = await account.plan.get()
      if (result.error) throw new Error('getting plan', { cause: result.error })
      return result.ok
    },
    onError: logAndCaptureError,
    ...config
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

/**
 * A specialized version of `usePlan` for the PlanGate component.
 * This hook uses SWR for polling and caching but treats a 'PlanNotFound'
 * error as a stable `null` state instead of throwing an error. This prevents
 * unwanted page refreshes while waiting for a user to select a plan.
 *
 * Other errors are re-thrown to be handled by SWR's error state.
 */
export const usePlanGate = (account: Account, isDetectionComplete: boolean) => {
  console.log('usePlanGate: Hook initiated.')
  const [plan, setPlan] = useState<PlanGetSuccess | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const intervalId = useRef<NodeJS.Timeout | null>(null)
  const isFetching = useRef(false)

  useEffect(() => {
    console.log('usePlanGate: useEffect triggered.', { isDetectionComplete, account: !!account })
    if (!isDetectionComplete || !account) {
      if (!isDetectionComplete) console.log('usePlanGate: Iframe detection not complete, returning.')
      if (!account) console.log('usePlanGate: Account not available, returning.')
      return
    }

    const pollPlan = async () => {
      if (isFetching.current) {
        console.log('usePlanGate: Fetch in progress, skipping poll.')
        return
      }
      console.log('usePlanGate: Polling for plan...')
      isFetching.current = true

      try {
        const result = await account.plan.get()
        console.log('usePlanGate: API call result:', result)
        if (result.ok) {
          console.log('usePlanGate: Plan found, clearing interval and setting state.')
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
          setPlan(result.ok)
        } else if (result.error && result.error.name !== 'PlanNotFound') {
          console.error('usePlanGate: Critical error found, clearing interval and setting error state.', result.error)
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
          setError(new Error('Failed to get plan', { cause: result.error }))
        } else {
          console.log('usePlanGate: PlanNotFound, continuing to poll.')
        }
      } catch (e) {
        console.error('usePlanGate: Exception caught, clearing interval and setting error state.', e)
        if (intervalId.current) {
          clearInterval(intervalId.current)
        }
        setError(e as Error)
      } finally {
        isFetching.current = false
        if (isLoading) {
          console.log('usePlanGate: Initial fetch complete, setting isLoading to false.')
          setIsLoading(false)
        }
      }
    }

    console.log('usePlanGate: Setting up initial fetch and polling.')
    pollPlan()
    intervalId.current = setInterval(pollPlan, 3000)

    return () => {
      console.log('usePlanGate: Cleanup effect, clearing interval.')
      if (intervalId.current) {
        clearInterval(intervalId.current)
      }
    }
  }, [account, isDetectionComplete, isLoading])

  return { plan, error, isLoading }
}
