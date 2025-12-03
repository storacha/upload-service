import { ReactNode } from 'react'
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
          <h3 className="text-xl">{storage} Egress</h3>
          <h5>Additional at ${overage}/GB per month</h5>
        </div>
        <PickPlanButton pick={pick} planID={planID} freeTrial={freeTrial}>
          Start Storing
        </PickPlanButton>
      </div>
    </div>
  )
}

interface PricingTableProps {
  freeTrial?: boolean
  redirectAfterCheckout?: boolean
}

interface CreateCheckoutSessionProps {
  planID: DID
  freeTrial?: boolean
  successURL?: string
  cancelURL?: string
  redirectAfterCompletion?: boolean
}

function createSuccessUrl(){
  const u = new URL(location.href)
  u.searchParams.append("checkout-success", "true")
  return u.href
}

function createCancelUrl() {
  const u = new URL(location.href)
  u.searchParams.append("checkout-success", "false")
  return u.href
}


export default function StripePricingTable({ freeTrial = false, redirectAfterCheckout = true }: PricingTableProps) {
  const [{ accounts, client }] = useW3()
  const account = accounts[0]
  async function startCheckoutSession(planID: DID) {
    if (!client) {
      throw new Error(
        'tried to create checkout session but storacha client is not defined'
      )
    } else {
      const checkoutProps: CreateCheckoutSessionProps = {
        planID,
        freeTrial,
      }
      if (redirectAfterCheckout){
        checkoutProps.successURL = createSuccessUrl()
        checkoutProps.cancelURL = createCancelUrl()
      } else {
        checkoutProps.redirectAfterCompletion = false
      }
      const response = await client?.capability.plan.createCheckoutSession(
        account.did(),
        checkoutProps
      )
      window.open(response.url)
    }
  }
  return (
    <div className="flex flex-col md:flex-row gap-8 justify-center m-8">
      <PlanPicker
        name="Starter"
        peppers={1}
        price={0}
        storage="5GB"
        overage={0.15}
        planID="did:web:starter.storacha.network"
        pick={startCheckoutSession}
        freeTrial={freeTrial}
      />
      <PlanPicker
        name="Lite"
        peppers={2}
        price={10}
        storage="100GB"
        overage={0.05}
        planID="did:web:lite.storacha.network"
        pick={startCheckoutSession}
        freeTrial={freeTrial}
      />
      <PlanPicker
        name="Business"
        peppers={3}
        price={100}
        storage="2TB"
        overage={0.03}
        planID="did:web:business.storacha.network"
        pick={startCheckoutSession}
        freeTrial={freeTrial}
      />
    </div>
  )
}

export function StripeTrialPricingTable({ className = '' }) {
  return (<StripePricingTable freeTrial={true} />)
}

export function SSOIframeStripePricingTable({ className = '' }) {
  return (<StripePricingTable redirectAfterCheckout={false} />)
}
