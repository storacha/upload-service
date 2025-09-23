'use client'

import { ReactNode, useMemo } from 'react'
import { useW3 } from '@storacha/ui-react'
import StripePricingTable, { StripeTrialPricingTable, SSOIframeStripePricingTable } from './PricingTable'
import { TopLevelLoader } from './Loader'
import { Logo } from '@/brand'
import { useConditionalPlan } from '@/hooks'
import { useSearchParams } from 'next/navigation'
import { useIframe } from '@/contexts/IframeContext'
import { useRecordRefcode } from '@/lib/referrals/hooks'
import Link from 'next/link'

const PricingTable = ({
  email,
  referredBy,
}: {
  email: string
  referredBy?: string
}) => {
  const { isIframe } = useIframe()
  
  return (
    <div className="flex flex-col justify-center items-center min-h-screen relative">
      <div className="my-6">
        <Logo />
      </div>
      <Link
        href="https://storacha.console.network/logout"
        className="absolute top-4 right-4 bg-hot-red text-white px-4 py-2 rounded-full shadow-md hover:border-white transition"
      >
        &larr; Back
      </Link>
      <div className="max-w-screen-lg font-epilogue text-black text-center bg-white border border-hot-red rounded-2xl overflow-hidden p5 mx-4 mb-4">
        {referredBy ? (
          <>
            <div className="px-6 py-6 lg:px-24">
              <h1 className="my-4 font-bold">Welcome, {email}!</h1>
              <p className="my-4">
                Congratulations! You are eligible for a free trial of our Lite or
                Business subscriptions. That means we won&apos;t charge you
                anything today. If you choose a Lite plan, you will get two months
                for free! If you choose Business, you will get one month for free!
                We do need you to provide a valid credit card before we can start
                your trial - pick a plan below and complete the checkout flow to
                get started!
              </p>
              <p className="my-4">
                Please note that after your free trial ends, you will be charged
                10 USD per month for Lite or 100 USD per month for Business tier.
              </p>
            </div>
            {isIframe ? <SSOIframeStripePricingTable /> : <StripeTrialPricingTable />}
          </>
        ) : (
          <>
            <div className="px-6 py-6 lg:px-24">
              <h1 className="my-4 font-bold">Welcome, {email}!</h1>
              <p className="my-4">
                To get started you&apos;ll need to sign up for a subscription. If
                you choose the starter plan we won&apos;t charge your credit card,
                but we do need a card on file before we will store your bits.
              </p>
              <p className="my-4">
                Pick a plan below and complete the Stripe checkout flow to get
                started!
              </p>
            </div>
            {isIframe ? <SSOIframeStripePricingTable /> : <StripePricingTable />}
          </>
        )}
      </div>
    </div>
  )
}

export function PlanGate({ children }: { children: ReactNode }): ReactNode {
  const [{ accounts }] = useW3()
  const account = accounts[0]
  const { isDetectionComplete } = useIframe()

  // Always call hooks at the top level
  const email = useMemo(() => account?.toEmail() || '', [account])
  const { plan, error, isLoading } = useConditionalPlan(account)
  const referralResult = useRecordRefcode()
  const referredBy = isDetectionComplete ? referralResult.referredBy : undefined

  // An account is required to check for a plan or show the pricing table.
  // If there's no account, we're still in the loading phase.
  if (!account) {
    return <TopLevelLoader />
  }

  // Show loader while waiting for plan, regardless of iframe context
  if (isLoading) {
    return <TopLevelLoader />
  }

  // Handle errors from the hook
  if (error) {
    if (error.cause?.name === 'PlanNotFound') {
      return <PricingTable email={email} referredBy={referredBy} />
    } else {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen">
          <div className="my-6">
            <Logo />
          </div>
          <div className="max-w-screen-lg font-epilogue text-black text-center bg-white border border-hot-red rounded-2xl overflow-hidden p5 mx-4 mb-4 p-4">
            <p className="my-4">
              Sorry! We encountered an error looking up your billing plan.
            </p>
            <p className="my-4">
              Please wait a few moments and reload the page.
            </p>
            <p className="my-4">
              If this error does not go away, please contact{' '}
              <a href="mailto:support@storacha.network">
                support@storacha.network.
              </a>
            </p>
          </div>
        </div>
      )
    }
  }

  // Show pricing table if plan doesn't exist or no product is selected
  if (!plan || !plan.product) {
    return <PricingTable email={email} referredBy={referredBy} />
  }

  return children
}

export function MaybePlanGate({
  children,
}: {
  children: ReactNode
}): ReactNode {
  const params = useSearchParams()
  if (
    process.env.NEXT_PUBLIC_DISABLE_PLAN_GATE == 'true' ||
    params.get('checkout.session')
  ) {
    return children
  } else {
    return <PlanGate>{children}</PlanGate>
  }
}