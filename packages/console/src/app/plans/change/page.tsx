'use client'

import { usePlan } from "@/hooks"
import { useW3, DID, Client, AccountDID, Account } from "@storacha/ui-react"
import { ArrowTopRightOnSquareIcon, RocketLaunchIcon, CheckIcon, LinkIcon } from '@heroicons/react/24/outline'
import DefaultLoader from "@/components/Loader"
import { useState } from "react"
import SidebarLayout from "@/components/SidebarLayout"
import { toast } from 'react-hot-toast'
import { ucantoast } from "@/toaster"
import { ArrowPathIcon } from "@heroicons/react/20/solid"
import { useForm, SubmitHandler } from 'react-hook-form'
import { delegate } from "@ucanto/core/delegation"
import * as Access from "@storacha/access/access"
import * as DidMailto from "@storacha/did-mailto"
import * as Ucanto from "@ucanto/core"
import { Plan, Access as AccessCaps } from "@storacha/capabilities"
import { H1, H2 } from "@/components/Text"
import { Ability, Capability, Delegation } from "@ucanto/interface"
import { SettingsNav } from "@/app/settings/layout"

interface PlanSectionProps {
  account: Account
  planID: DID
  planName: string
  planLabel: string
  flatFee: number
  flatFeeAllotment: number
  perGbFee: number
}

export const PLANS: Record<string, DID<'web'>> = {
  starter: 'did:web:starter.web3.storage',
  lite: 'did:web:lite.web3.storage',
  business: 'did:web:business.web3.storage',
}

const planRanks: Record<string, number> = {
  [PLANS['starter']]: 0,
  [PLANS['lite']]: 1,
  [PLANS['business']]: 2
}

const buttonText = (currentPlan: string, newPlan: string) => (planRanks[currentPlan] > planRanks[newPlan]) ? 'Downgrade' : 'Upgrade'

function PlanSection ({ account, planID, planName, planLabel, flatFee, flatFeeAllotment, perGbFee }: PlanSectionProps) {
  const { data: plan, setPlan, isLoading } = usePlan(account)
  const currentPlanID = plan?.product
  const isCurrentPlan = currentPlanID === planID
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false)
  async function selectPlan (selectedPlanID: DID) {
    try {
      setIsUpdatingPlan(true)
      await ucantoast(setPlan(selectedPlanID), {
        loading: "Updating plan...",
        success: "Plan updated!",
        error: "Failed to update plan, check the console for more details."
      })
    } finally {
      setIsUpdatingPlan(false)
    }
  }
  return (
    <div className={`rounded-2xl font-epilogue text-hot-red border border-hot-red w-full max-w-sm mx-auto lg:max-w-none lg:w-[21rem] bg-white`}>
      <div className='uppercase text-sm sm:text-md px-4 sm:px-5 py-2 flex flex-row justify-between w-full border-b border-hot-red'>
        <div>{planName}</div>
        <div className='text-xs sm:text-md'>{planLabel}</div>
      </div>
      <div className='px-4 sm:px-5 py-4 sm:py-6'>
        <p className='text-3xl sm:text-4xl lg:text-5xl mt-2 mb-4 sm:mb-5'>${flatFee}/mo</p>
        <p className='text-lg sm:text-xl lg:text-2xl uppercase'>{flatFeeAllotment.toLocaleString()}GB storage</p>
        <p className='text-xs mb-4 sm:mb-5'>Additional at ${perGbFee}/GB per month</p>
        <p className='text-lg sm:text-xl lg:text-2xl uppercase'>{flatFeeAllotment.toLocaleString()}GB egress</p>
        <p className='text-sm uppercase'>per month</p>
        <p className='text-xs mb-4 sm:mb-5'>Additional at ${perGbFee}/GB per month</p>
        <div className='text-center'>
          {
            (isLoading || isUpdatingPlan || !currentPlanID) ? (
              <DefaultLoader className='h-6 w-6' />
            ) : (
              isCurrentPlan ? (
                <button className={`inline-block border border-hot-red bg-white text-hot-red font-epilogue uppercase text-xs sm:text-sm px-4 sm:px-6 py-2 rounded-lg whitespace-nowrap cursor-not-allowed opacity-75`} disabled={true}>
                  <CheckIcon className='h-4 w-4 sm:h-5 sm:w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Current Plan
                </button>
              ) : (
                <button 
                  onClick={() => selectPlan(planID)} 
                  className={`inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-xs sm:text-sm px-4 sm:px-6 py-2 rounded-lg whitespace-nowrap ${isCurrentPlan ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} 
                  disabled={isCurrentPlan || isLoading || isUpdatingPlan}
                >
                  <RocketLaunchIcon className='h-4 w-4 sm:h-5 sm:w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> {currentPlanID && buttonText(currentPlanID, planID)}
                </button>
              )
            )
          }
        </div>
      </div>
    </div>
  )
}

function getCapabilities (delegations: Delegation[]): Capability[] {
  if (delegations.length === 0) {
    return []
  } else {
    return delegations.map(delegation => {
      return delegation.capabilities.concat(getCapabilities(delegation.proofs as Delegation[]))
    }).flat()
  }
}

function doesCapabilityGrantAbility (capability: Ability, ability: Ability) {
  if (capability === ability) {
    return true
  } else if (capability.endsWith('/*')) {
    return ability.startsWith(capability.slice(0, -1))
  } else {
    return false
  }
}

function findAccountResourcesWithCapability (client: Client, ability: Ability): Set<AccountDID> {
  return new Set(
    getCapabilities(client.proofs([{ can: ability, with: 'ucan:*' }]))
      .filter(cap => {
        const isAccount = cap.with.startsWith('did:mailto:')
        return doesCapabilityGrantAbility(cap.can, ability) && isAccount
      })
      .map(cap => cap.with) as AccountDID[]
  )
}

interface DelegationPlanCreateAdminSessionInput {
  email: string
}

function DelegatePlanCreateAdminSessionForm ({ className = '', account }: { className?: string, account: Account }) {
  const [{ client }] = useW3()

  const { register, handleSubmit } = useForm<DelegationPlanCreateAdminSessionInput>()
  const onSubmit: SubmitHandler<DelegationPlanCreateAdminSessionInput> = async (data) => {
    if (client && account) {
      const email = data.email as `${string}@${string}`
      const capabilities = [
        {
          with: account.did(),
          can: Plan.createAdminSession.can
        },
        {
          with: account.did(),
          can: Plan.get.can
        },
        {
          with: account.did(),
          can: Plan.set.can
        }
      ]
      await ucantoast(Access.delegate(client.agent, {
        delegations: [
          await delegate({
            issuer: client.agent.issuer,
            audience: Ucanto.DID.parse(DidMailto.fromEmail(email)),
            // @ts-expect-error not sure why TS doesn't like this but I'm pretty sure it's safe to ignore
            capabilities,
            // TODO default to 1 year for now, but let's add UI for this soon
            lifetimeInSeconds: 60 * 60 * 24 * 365,
            proofs: client.proofs(capabilities)
          })

        ]
      }), {
        loading: 'Delegating...',
        success: `Delegated billing portal access to ${email}.`,
        error: `Error delegating billing portal access to ${email}.`
      })
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className={className}>
      <label className='block mb-4'>
        <p className='text-black mb-4 break-words max-w-full overflow-hidden'>
          Delegate access to <span className='break-all'>{DidMailto.toEmail(account.did())}</span>&apos;s billing admin portal:
        </p>
        <input className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-full max-w-md'
          placeholder='To Email' type='email'
          {...register('email')} />
      </label>
      <input className='inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm mr-2 px-6 py-2 rounded-lg whitespace-nowrap cursor-pointer' type='submit' value='Delegate' />
    </form>
  )
}

function CustomerPortalLink ({ did }: { did: AccountDID }) {
  const { customerPortalLink, generateCustomerPortalLink, generatingCustomerPortalLink } = useCustomerPortalLink()
  return (
    <>
      {customerPortalLink ? (
        <div className='flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2'>
          <button className='inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-lg whitespace-nowrap' onClick={() => generateCustomerPortalLink(did)} disabled={generatingCustomerPortalLink}>
            <ArrowPathIcon className={`h-5 w-5 inline-block align-middle ${generatingCustomerPortalLink ? 'animate-spin' : ''}`} />
          </button>
          <a className='inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-lg whitespace-nowrap text-center' href={customerPortalLink} target="_blank" rel="noopener noreferrer">
            Open Billing Portal
            <ArrowTopRightOnSquareIcon className='relative inline h-5 w-4 ml-1 -mt-1' />
          </a>
        </div>
      ) : (
        <button onClick={() => generateCustomerPortalLink(did)} disabled={generatingCustomerPortalLink} className='inline-block bg-white border border-hot-red hover:bg-hot-red hover:text-white font-epilogue text-hot-red uppercase text-sm px-6 py-2 rounded-lg whitespace-nowrap'>
          {generatingCustomerPortalLink ? <ArrowPathIcon className='h-5 w-5 inline-block mr-1 align-middle animate-spin' style={{marginTop: -4}} /> : <LinkIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} />} Generate Link
        </button>
      )}
    </>
  )
}

function useCustomerPortalLink () {
  const [{ client, accounts }] = useW3()
  const account = accounts[0]
  const [customerPortalLink, setCustomerPortalLink] = useState<string>()
  const [generatingCustomerPortalLink, setGeneratingCustomerPortalLink] = useState(false)
  async function generateCustomerPortalLink (did: AccountDID) {
    if (!client) {
      toast.error('Error creating Stripe customer portal session, please see the console for more details.')
      console.debug(`w3up client is ${client}, could not generate customer portal link`)
    } else if (!account) {
      toast.error('Error creating Stripe customer portal session, please see the console for more details.')
      console.debug(`w3up account is ${account}, could not generate customer portal link`)
    } else {
      setGeneratingCustomerPortalLink(true)
      const result = await account.plan.createAdminSession(did, location.href)
      setGeneratingCustomerPortalLink(false)
      if (result.ok) {
        setCustomerPortalLink(result.ok.url)
      } else {
        toast.error('Error creating Stripe customer portal session, please see the console for more details.')
        console.debug("Error creating admin session:", result.error)
      }
    }
  }
  return { customerPortalLink, generateCustomerPortalLink, generatingCustomerPortalLink }
}

interface AccountAdminProps {
  account: Account
  accountNamePrefix?: string
}

function AccountAdmin ({ account, accountNamePrefix = '' }: AccountAdminProps) {
  const canDelegate = account.agent.proofs([{ can: AccessCaps.delegate.can, with: account.did() }]).length > 0
  return (
    <div className='mb-8'>
      <div className='mb-6 bg-opacity-80 bg-white text-hot-red py-2 px-4 sm:px-5 rounded-full break-words max-w-full sm:max-w-4xl shadow-inner'>
        <H2 className='text-sm sm:text-base lg:text-lg'>{accountNamePrefix}{DidMailto.toEmail(account.did())}</H2>
      </div>
      <div className='max-w-full sm:max-w-4xl'>
        <div className='flex flex-col lg:flex-row lg:space-x-4 space-y-4 lg:space-y-0 mb-4'>
          <PlanSection account={account} planID={PLANS['starter']} planName='Starter' planLabel='🌶️' flatFee={0} flatFeeAllotment={5} perGbFee={0.15} />
          <PlanSection account={account} planID={PLANS['lite']} planName='Lite' planLabel='🌶️🌶️' flatFee={10} flatFeeAllotment={100} perGbFee={0.05} />
          <PlanSection account={account} planID={PLANS['business']} planName='Business' planLabel='🔥 Best Value 🔥' flatFee={100} flatFeeAllotment={2000} perGbFee={0.03} />
        </div>
        <div className='rounded-2xl font-epilogue text-hot-red border border-hot-red bg-white p-4 sm:p-5'>
          <H1 className='mt-0 mb-4 text-lg sm:text-xl lg:text-2xl'>Billing Administration</H1>
          <p className='text-black mb-4 text-sm sm:text-base'>Access Billing Admin Portal</p>
          <CustomerPortalLink did={account.did()} />
          {canDelegate && <DelegatePlanCreateAdminSessionForm account={account} className='mt-6' />}
        </div>
      </div>
    </div>
  )
}

function Plans () {
  const [{ client, accounts }] = useW3()
  const account = accounts[0]

  const billingAdminAccounts: Set<AccountDID> = client ? findAccountResourcesWithCapability(client, Plan.createAdminSession.can) : new Set()
  const planAdminAccounts: Set<AccountDID> = client ? findAccountResourcesWithCapability(client, Plan.set.can) : new Set()
  const adminableAccounts: AccountDID[] = Array.from(new Set<AccountDID>([...billingAdminAccounts, ...planAdminAccounts]))
  const hasAdminableAccounts = adminableAccounts.length > 0
  return (
    <>
      <SettingsNav />
      <H1>Change Plan</H1>
      <AccountAdmin account={account} accountNamePrefix={hasAdminableAccounts ? 'Your Account: ' : ''} />
      {adminableAccounts.map(did => (client && (did !== account.did()) ? (
        <AccountAdmin key={did}
          accountNamePrefix={hasAdminableAccounts ? 'External Account: ' : ''}
          account={new Account({
            id: did as DidMailto.DidMailto,
            agent: client.agent,
            proofs: []
          })} />
      ) : null))}
    </>
  )
}

export default function PlansPage () {
  return (
    <SidebarLayout>
      <Plans />
    </SidebarLayout>
  )
}
