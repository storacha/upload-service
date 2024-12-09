'use client'

import { ReactNode, useState } from 'react'
import { useW3 } from '@w3ui/react'
import StripePricingTable, { StripeTrialPricingTable } from './PricingTable';
import { TopLevelLoader } from './Loader';
import { Logo } from '@/brand';
import { usePlan } from '@/hooks';
import { useRecordRefcode, useReferredBy } from '@/lib/referrals/hooks';

export function PlanGate ({ children }: { children: ReactNode }): ReactNode {
  const [{ accounts }] = useW3()
  const email = accounts[0]?.toEmail()
  const { data: plan, error } = usePlan(accounts[0])
  const { referredBy } = useRecordRefcode()
  if (!plan && !error) {
    return <TopLevelLoader />
  }
  if (!plan?.product) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div className='my-6'><Logo /></div>
        <div className="max-w-screen-lg font-epilogue text-black text-center bg-white border border-hot-red rounded-2xl overflow-hidden p5 mx-4 mb-4">
          {referredBy ? (
            <>
              <div className='px-6 py-6 lg:px-24'>
                <h1 className="my-4 font-bold">Welcome, {email}!</h1>
                <p className='my-4'>
                  Congratulations! You are eligible for a free trial of our Lite or Business subscriptions. That means
                  we won&apos;t charge you anything today.
                  If you choose a Lite plan, you will get two months for free! If you choose Business, you will get one month for free!
                  We do need you to provide a valid credit card before we can start your
                  trial - pick a plan below and complete the checkout flow to get started!
                </p>
                <p className='my-4'>
                  Please note that after your free trial ends, you will be charged 10 USD per month for Lite or 100 USD per month for Business tier.
                </p>
              </div>
              <StripeTrialPricingTable />
            </>
          ) : (
            <>
              <div className='px-6 py-6 lg:px-24'>
                <h1 className="my-4 font-bold">Welcome, {email}!</h1>
                <p className='my-4'>
                  To get started you&apos;ll need to sign up for a subscription. If you choose
                  the starter plan we won&apos;t charge your credit card, but we do need a card on file
                  before we will store your bits.
                </p>
                <p className='my-4'>
                  Pick a plan below and complete the Stripe checkout flow to get started!
                </p>
              </div>
              <StripePricingTable />
            </>
          )
          }
        </div >
      </div >
    )
  }

  return children
}

export function MaybePlanGate ({ children }: { children: ReactNode }): ReactNode {
  if (process.env.NEXT_PUBLIC_DISABLE_PLAN_GATE == 'true') {
    return children
  } else {
    return <PlanGate>{children}</PlanGate>
  }
}