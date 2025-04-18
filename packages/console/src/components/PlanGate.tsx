'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useW3 } from '@storacha/ui-react'
import StripePricingTable, { StripeTrialPricingTable } from './PricingTable';
import { TopLevelLoader } from './Loader';
import { Logo } from '@/brand';
import { usePlan } from '@/hooks';
import { useRecordRefcode } from '@/lib/referrals/hooks';
import { useSearchParams } from 'next/navigation';
import { base64url } from 'multiformats/bases/base64'
import { authorize } from '@storacha/capabilities/access';

function HumanodeAuthLink ({className}: {className?: string}) {
  const [{ accounts, client }] = useW3()
  const account = accounts[0]
  const [state, setState] = useState<string>()

  useEffect(function () {
    (async () => {
      if (client) {
        // Create an access/authorize request that can be used as the state of the OAuth request.
        const request = await authorize.delegate({
          audience: client.agent.connection.id,
          issuer: client.agent.issuer,
          // agent that should be granted access
          with: client.agent.did(),
          // capabilities requested (account access)
          nb: {
            iss: account.did(),
            att: [{ 
              can: '*',
            }]
          },
          // expire this after 15 minutes
          expiration:  Math.floor(Date.now() / 1000) + 60 * 15
        })
        const archive = await request.archive()
        if (archive?.ok) {
          setState(base64url.encode(archive.ok))
        } else {
          console.warn('could not create auth delegation')
        }
      }
    })()
  }, [client, account])
  return (
    <a className={className || ''}
       href={`${process.env.NEXT_PUBLIC_HUMANODE_AUTH_URL}?response_type=code&client_id=${process.env.NEXT_PUBLIC_HUMANODE_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_HUMANODE_OAUTH_CALLBACK_URL}&scope=openid&state=${state}`} target="_blank" rel="noopener noreferrer">
      Prove my Humanity!
    </a>  
  )
}

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
      <div className="flex flex-col justify-center items-center min-h-screen font-epilogue ">
        <div className='my-6'><Logo /></div>
        <div className="max-w-screen-lg text-black text-center bg-white border border-hot-red rounded-2xl overflow-hidden p5 mx-4 mb-4">
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
                  the starter plan we won&apos;t charge your credit card.
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
        <div className="3xl font-black mb-2">OR</div>
        <div className="flex flex-col items-center space-y-4  bg-white border border-hot-red rounded-2xl overflow-hidden">
          <div className="font-bold 3xl px-8 pt-8 pb-2">
            Prove you&apos;re a human and get free storage with no credit card!
          </div>
          <div className="bg-black w-full flex flex-col items-center p-8">
            <HumanodeAuthLink className="bg-pink-300 rounded-lg py-3 w-72 text-center"/>
          </div>
        </div>
      </div >
    )
  }

  return children
}

export function MaybePlanGate ({ children }: { children: ReactNode }): ReactNode {
  const params = useSearchParams()
  if ((process.env.NEXT_PUBLIC_DISABLE_PLAN_GATE == 'true') || params.get('checkout.session')) {
    return children
  } else {
    return <PlanGate>{children}</PlanGate>
  }
}