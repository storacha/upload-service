'use client';
import { useW3, SpaceDID } from '@storacha/ui-react'
import useSWR from 'swr'
import Link from 'next/link'
import { usePlan } from '@/hooks'
import { SettingsNav } from './layout'
import { H1, H2, H3 } from '@/components/Text'
import { GB, MB, TB, filesize } from '@/lib'
import DefaultLoader from '@/components/Loader'
import { RefcodeLink, ReferralsList, RefcodeCreator } from '../referrals/page'
import { useReferrals } from '@/lib/referrals/hooks'
import { logAndCaptureError } from '@/sentry'

import type { JSX } from "react";

const Plans: Record<`did:${string}`, { name: string, limit: number }> = {
  'did:web:starter.web3.storage': { name: 'Starter', limit: 5 * GB },
  'did:web:lite.web3.storage': { name: 'Lite', limit: 100 * GB },
  'did:web:business.web3.storage': { name: 'Business', limit: 2 * TB },
  'did:web:free.web3.storage': { name: 'Free', limit: Infinity },
  'did:web:trial.storacha.network': { name: 'Trial', limit: 100 * MB },
}

const MAX_REFERRALS = 11
const MAX_CREDITS = 460

export default function SettingsPage (): JSX.Element {
  const [{ client, accounts }] = useW3()
  // TODO: introduce account switcher
  const account = accounts[0]

  const { data: plan } = usePlan(account)

  const { data: usage } = useSWR<Record<SpaceDID, number> | undefined>(`/usage/${account ?? ''}`, {
    fetcher: async () => {
      if (!account || !client) return

      const result = await client.capability.account.usage.get(account.did())
      return Object.entries(result.spaces).reduce((m, [spaceDID, value]) => {
        m[spaceDID as SpaceDID] = value.total
        return m
      }, {} as Record<SpaceDID, number>)
    },
    onError: logAndCaptureError
  })

  const product = plan?.product
  const planName = product && Plans[product]
    ? Plans[plan.product].name
    : 'Unknown'
  const allocated = Object.values(usage ?? {}).reduce((total, n) => total + n, 0)
  const limit = plan?.product ? Plans[plan.product]?.limit : 0

  const { referrals, referralLink, setReferrerEmail, accountEmail, urlQueryEmail, createRefcode, mutateRefcode, } = useReferrals()

  const referred = referrals?.length || 0

  // TODO: need to calculate these from the referral information that gets added during the TBD cronjob
  const credits = 0
  const points = 0
  return (
    <>
      <SettingsNav />
      <H1>Settings</H1>
      <H2>Rewards</H2>
      <div className='flex flex-row space-x-2 justify-between max-w-4xl mb-4'>
        <div className='border border-hot-red rounded-2xl bg-white p-5 flex-grow'>
          <H3>Referred</H3>
          <span className='text-4xl'>{referred}</span> / {MAX_REFERRALS}
        </div>
        <div className='border border-hot-red rounded-2xl bg-white p-5 flex-grow'>
          <H3>USD Credits</H3>
          <span className='text-4xl'>{credits}</span> / {MAX_CREDITS}
        </div>
        <div className='border border-hot-red rounded-2xl bg-white p-5 flex-grow'>
          <H3>Racha Points</H3>
          <span className='text-4xl'>{points}</span>
        </div>
      </div>
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl mb-4'>
        <ReferralsList />
        {referralLink ? (
          <RefcodeLink referralLink={referralLink} />
        ) : (
          <RefcodeCreator
            accountEmail={accountEmail}
            urlQueryEmail={urlQueryEmail}
            createRefcode={createRefcode}
            mutateRefcode={mutateRefcode}
            setReferrerEmail={setReferrerEmail} />)}
      </div>
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
        <H2>Plan</H2>
        <p className='font-epilogue mb-4'>
          <span className='text-xl mr-2'>{planName}</span>
          <Link className='underline text-sm'
            href='/plans/change'>
            change
          </Link>
        </p>
        <H2>Usage</H2>
        {usage && limit ? (
          <>
            <p className='font-epilogue mb-4'>
              <span className='text-xl'>{filesize(allocated)}</span>
              <span className='text-sm'> of {limit === Infinity ? 'Unlimited' : filesize(limit)}</span>
            </p>
            <table className='border-collapse table-fixed w-full'>
              {Object.entries(usage).sort((a, b) => b[1] - a[1]).map(([space, total]) => {
                return (
                  <tr key={space} className='border-b border-hot-red last:border-b-0'>
                    <td className='text-xs font-mono py-2'><Link href={`/space/${space}`}>{space}</Link></td>
                    <td className='text-xs text-right py-2'>{filesize(total)}</td>
                  </tr>
                )
              })}
            </table>
          </>
        ) : <DefaultLoader className='w-6 h-6 inline-block' />}
      </div>
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl mt-4'>
        <H2>Account Management</H2>
        <button 
          onClick={() => window.open('https://forms.gle/QsvfMip2qzJqzEEo9', '_blank')}
          className='bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200'
        >
          Request Account Deletion
        </button>
      </div>
    </>
  )
}

const startOfMonth = (now: string | number | Date) => {
  const d = new Date(now)
  d.setUTCDate(1)
  d.setUTCHours(0)
  d.setUTCMinutes(0)
  d.setUTCSeconds(0)
  d.setUTCMilliseconds(0)
  return d
}

const startOfLastMonth = (now: string | number | Date) => {
  const d = startOfMonth(now)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d
}
