'use client'

import { ReactNode, useState } from 'react'
import { useW3 } from '@w3ui/react'
import StripePricingTable from './PricingTable';
import { TopLevelLoader } from './Loader';
import { Logo } from '@/brand';
import { usePlan } from '@/hooks';

export function PlanGate ({ children }: { children: ReactNode }): ReactNode {
  const [{ accounts }] = useW3()
  const { data: plan, error } = usePlan(accounts[0])
  if (!plan && !error) {
    return <TopLevelLoader />
  }

  if (!plan?.product) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div className='my-6'><Logo /></div>
        <div className="max-w-screen-lg font-epilogue text-black text-center bg-white border border-hot-red rounded-2xl overflow-hidden p5 mx-4 mb-4">
          <div className='px-6 py-6 lg:px-24'>
            <h1 className="my-4 font-bold">Welcome {accounts[0]?.toEmail()}!</h1>
            <p className='my-4'>
              To get started you&apos;ll need to sign up for a subscription. If you choose
              the starter plan we won&apos;t charge your credit card, but we do need a card on file
              before we will store your bits.
            </p>
            <p className='my-4'>
              Pick a plan below and complete the Stripe signup flow to get started!
            </p>
          </div>
          <StripePricingTable />
        </div>
      </div>
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