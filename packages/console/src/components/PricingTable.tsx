import { createElement } from 'react'
import Script from 'next/script'
import { useKeyring } from '@w3ui/react-keyring'

export default function StripePricingTable ({ className = '' }) {
  const [{ account }] = useKeyring()
  return (
    <>
      <Script src="https://js.stripe.com/v3/pricing-table.js" />
      {createElement('stripe-pricing-table', {
        'pricing-table-id': process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID,
        'publishable-key': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        'customer-email': account,
        className
      }, '')}
    </>
  )
}
