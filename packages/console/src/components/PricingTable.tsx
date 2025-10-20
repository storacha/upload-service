import { createElement, ReactNode } from 'react'
import Script from 'next/script'
import { DID, useW3 } from '@storacha/ui-react'

interface PickerProps {
  pick: (planID: DID, freeTrial?: boolean) => void
  planID: DID
  freeTrial?: boolean
}

type PickPlanButtonProps = PickerProps & {
  children: ReactNode
}

function PickPlanButton({
  pick,
  planID,
  freeTrial = false,
  children,
}: PickPlanButtonProps) {
  return (
    <button
      className="bg-hot-red flex-shrink rounded-full text-white px-4 py-2"
      onClick={() => pick(planID, freeTrial)}
    >
      {children}
    </button>
  )
}

type PlanPickerProps = PickerProps & {
  name: string
  peppers: number
  price: number
  storage: string
  overage: number
}

function PlanPicker({
  name,
  peppers,
  price,
  storage,
  overage,
  pick,
  planID,
  freeTrial,
}: PlanPickerProps) {
  return (
    <div className="border-2 border-hot-red rounded-xl bg-white">
      <div className="flex flex-col justify-between px-4 py-2 border-b-2 border-hot-red">
        <h1 className="text-hot-red uppercase">{name}</h1>
        <span>{'🌶️'.repeat(peppers)}</span>
      </div>
      <div className="p-4 text-left text-hot-red flex flex-col">
        <h2 className="text-4xl font-bold">${price}/mo</h2>
        <div className="py-4">
          <h3 className="text-xl">{storage} Storage</h3>
          <h5>Additional at ${overage}/GB per month</h5>
        </div>
        <div className="py-4">
          <h3 className="text-xl">{storage}GB Storage</h3>
          <h5>Additional at ${overage}/GB per month</h5>
        </div>
        <PickPlanButton pick={pick} planID={planID} freeTrial={freeTrial}>
          Start Storing
        </PickPlanButton>
      </div>
    </div>
  )
}

export default function StripePricingTable({ className = '' }) {
  const [{ accounts, client }] = useW3()
  const account = accounts[0]
  async function startCheckoutSession(planID: DID) {
    if (!client) {
      throw new Error(
        'tried to create checkout session but storacha client is not defined'
      )
    } else {
      const response = await client?.capability.plan.createCheckoutSession(
        account.did(),
        {
          successURL: location.href,
          cancelURL: location.href,
          planID,
          freeTrial: false,
        }
      )
      window.open(response.url)
    }
  }
  return (
    <div className="flex flex-col md:flex-row gap-8">
      <PlanPicker
        name="Mild"
        peppers={1}
        price={0}
        storage="5GB"
        overage={0.15}
        planID="did:web:starter.storacha.network"
        pick={startCheckoutSession}
      />
      <PlanPicker
        name="Medium"
        peppers={2}
        price={10}
        storage="100GB"
        overage={0.05}
        planID="did:web:lite.storacha.network"
        pick={startCheckoutSession}
      />
      <PlanPicker
        name="Extra Spicy"
        peppers={3}
        price={100}
        storage="2TB"
        overage={0.03}
        planID="did:web:business.storacha.network"
        pick={startCheckoutSession}
      />
    </div>
  )
}

export function StripeTrialPricingTable({ className = '' }) {
  const [{ accounts }] = useW3()
  return (
    <>
      <Script src="https://js.stripe.com/v3/pricing-table.js" />
      {createElement(
        'stripe-pricing-table',
        {
          'pricing-table-id':
            process.env.NEXT_PUBLIC_STRIPE_TRIAL_PRICING_TABLE_ID,
          'publishable-key': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
          'customer-email': accounts[0]?.toEmail(),
          className,
        },
        ''
      )}
    </>
  )
}

export function SSOIframeStripePricingTable({ className = '' }) {
  const [{ accounts }] = useW3()
  return (
    <>
      <Script src="https://js.stripe.com/v3/pricing-table.js" />
      {createElement(
        'stripe-pricing-table',
        {
          'pricing-table-id':
            process.env.NEXT_PUBLIC_SSO_IFRAME_STRIPE_PRICING_TABLE_ID,
          'publishable-key':
            process.env.NEXT_PUBLIC_SSO_IFRAME_STRIPE_PRICING_TABLE_PUB_KEY,
          'customer-email': accounts[0]?.toEmail(),
          className,
        },
        ''
      )}
    </>
  )
}
