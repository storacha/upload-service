import { createElement } from 'react'
import Script from 'next/script'

export default function Plans({className=''}) {
  return (
    <>
      <Script async src="https://js.stripe.com/v3/pricing-table.js" />
      {createElement('stripe-pricing-table', {
        'pricing-table-id': process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID,
        'publishable-key': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        className
      }, '')}
    </>
  )
}