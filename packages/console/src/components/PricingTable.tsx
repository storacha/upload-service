import { createElement } from 'react'
import Script from 'next/script'
import { useW3 } from '@w3ui/react'

export default function StripePricingTable ({ className = '' }) {
  const [{ accounts }] = useW3()
  return (
    <>
      <Script src="https://js.stripe.com/v3/pricing-table.js" />
      {createElement('stripe-pricing-table', {
        'pricing-table-id': process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID,
        'publishable-key': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        'customer-email': accounts[0]?.toEmail(),
        className
      }, '')}
    </>
  )
}

export function StripeTrialPricingTable ({ className = '' }) {
  const [{ accounts }] = useW3()
  return (
    <>
      <Script src="https://js.stripe.com/v3/pricing-table.js" />
      {createElement('stripe-pricing-table', {
        'pricing-table-id': process.env.NEXT_PUBLIC_STRIPE_TRIAL_PRICING_TABLE_ID,
        'publishable-key': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        'customer-email': accounts[0]?.toEmail(),
        className
      }, '')}
    </>
  )
}
