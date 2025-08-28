import { Account, DID, PlanGetSuccess, PlanSetSuccess, PlanSetFailure, Result } from '@storacha/ui-react'
import { useState, useEffect, useRef } from 'react'
import useSWR, { SWRResponse, SWRConfiguration, mutate } from 'swr'
import { logAndCaptureError } from './sentry'
import { useIframe } from './contexts/IframeContext'

/**
 * SWR configuration that is aware of its iframe context.
 * When in an iframe, it disables all revalidation behaviors to prevent refreshes.
 */
export const useIframeAwareSWRConfig = (options?: SWRConfiguration): SWRConfiguration => {
  const { isIframe } = useIframe()

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
const planKey = ({ account }: { account: Account }) => {
  if (!account) {
    return null
  }
  return `/plan/${account.did()}`
}

type UsePlanResult = SWRResponse<PlanGetSuccess | undefined> & {
  setPlan: (plan: DID) => Promise<Result<PlanSetSuccess, PlanSetFailure>>
}

export const usePlan = (account: Account, options?: SWRConfiguration) => {
  const config = useIframeAwareSWRConfig(options)
    const result = useSWR<PlanGetSuccess | undefined>(planKey({ account }), {
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
  const { isIframe } = useIframe()
  // In an iframe, we need to poll for the plan.
  // The `usePlanGate` hook is designed for this purpose.
  const planGateResult = usePollingPlan(account, isDetectionComplete && isIframe)

  return planGateResult
}

/**
 * A hook that uses SWR to poll for a plan, designed for iframe contexts.
 * It treats 'PlanNotFound' as a stable state to avoid errors while waiting for a plan.
 * It also populates the SWR cache so other hooks can access the same data.
 */
const usePollingPlan = (account: Account, isEnabled: boolean) => {
  const [plan, setPlan] = useState<PlanGetSuccess | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const intervalId = useRef<NodeJS.Timeout | null>(null)
  const isFetching = useRef(false)

  useEffect(() => {
    if (!isEnabled || !account) {
      // Hook is disabled, or no account, so don't poll.
      // If we return early, isLoading remains true, and the PlanGate will show a loader.
      return
    }

    const pollPlan = async () => {
      // Prevent concurrent fetches
      if (isFetching.current) {
        return
      }
      isFetching.current = true

      try {
        const result = await account.plan.get()
        if (result.ok) {
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
          setPlan(result.ok)
          // Populate SWR cache so usePlan can access the same data
          mutate(planKey({ account }), result.ok, true)
          // Stop loading now that we have a plan
          setIsLoading(false)
        } else if (result.error && result.error.name !== 'PlanNotFound') {
          // For any other error, stop polling and set the error state.
          if (intervalId.current) {
            clearInterval(intervalId.current)
          }
          setError(result.error)
          // Stop loading because we have an error
          setIsLoading(false)
        }
        // If PlanNotFound, do nothing and let it poll again.
      } catch (e) {
        if (intervalId.current) {
          clearInterval(intervalId.current)
        }
        setError(e as Error)
        setIsLoading(false)
      } finally {
        isFetching.current = false
        // After the first poll attempt, the main loader can be removed
        // even if we are still polling for a plan.
        if (isLoading) {
          setIsLoading(false)
        }
      }
    }

    // Initial fetch, then poll
    pollPlan()
    intervalId.current = setInterval(pollPlan, 3000)

    // Cleanup on unmount
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current)
      }
    }
  }, [account, isEnabled])

  return { plan, error, isLoading }
}

/**
 * A hook that conditionally fetches a plan. It uses a polling strategy
 * inside an iframe (`usePlanGate`) and a standard SWR fetch (`usePlan`)
 * outside of an iframe. This prevents unnecessary polling in the main app.
 */
export const useConditionalPlan = (account: Account) => {
  const { isIframe, isDetectionComplete } = useIframe()

  // Use the polling hook if in an iframe and detection is complete.
  const { plan: pollingPlan, error: pollingError, isLoading: isPolling } = usePollingPlan(account, isIframe && isDetectionComplete)

  // Use the standard SWR hook if not in an iframe.
  // The `usePlan` hook is disabled via its fetcher until not in an iframe.
  const { data: swrPlan, error: swrError, isLoading: isSwrLoading } = usePlan(account, {
    isPaused: () => isIframe
  })

  if (isIframe) {
    return { plan: pollingPlan, error: pollingError, isLoading: isPolling || !isDetectionComplete }
  }

  return { plan: swrPlan, error: swrError, isLoading: isSwrLoading }
}
