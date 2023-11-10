'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useKeyring, Plan } from '@w3ui/react-keyring';
import StripePricingTable from './PricingTable';
import DefaultLoader from './Loader';
import { Web3StorageLogo, Web3StorageLogoIcon } from '@/brand';

export function PlanGate ({ children }: { children: ReactNode }): ReactNode {
  const [error, setError] = useState<any>()
  const [{ account }, { getPlan }] = useKeyring();
  const [plan, setPlan] = useState<Plan>()
  useEffect(function () {
    (async function () {
      if (account) {
        try {
          const result = await getPlan(account as `${string}@${string}`)
          if (result.ok) {
            setPlan(result.ok)
          } else {
            setError(result.error)
          }
        } catch (err) {
          console.error("CAUGHT ERROR", err)
          setError(err)
        }
      }
    })()
  }, [account, getPlan])
  if (!plan && !error) {
    return <DefaultLoader className='w-12 h-12 text-white' />
  }

  if (!plan?.product) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <div className='my-4'><Web3StorageLogo /></div>
        <div className="max-w-screen-lg text-zinc-950 text-center bg-white/20 rounded-lg px-1 py-1">
          <div className='px-6 py-6 lg:px-24'>
            <h1 className="my-4 font-bold">Welcome {account}!</h1>
            <p className='my-4'>
              To get started with w3up you&apos;ll need to sign up for a subscription. If you choose
              the free plan we won&apos;t charge your credit card, but we do need a card on file
              before we will store your bits.
            </p>
            <p className='my-4'>
              Pick a plan below and complete the Stripe signup flow to get started!
            </p>
          </div>
          <div className='rounded-lg overflow-hidden'>
            <StripePricingTable />
          </div>
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