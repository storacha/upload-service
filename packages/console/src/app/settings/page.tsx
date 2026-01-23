'use client'
import { useW3, SpaceDID, Account } from '@storacha/ui-react'
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

import type { JSX } from 'react'
import CopyButton from '@/components/CopyButton'

const Plans: Record<
  `did:${string}`,
  { name: string; limit: number; egressLimit: number }
> = {
  // web3.storage plans
  'did:web:starter.web3.storage': {
    name: 'Starter',
    limit: 5 * GB,
    egressLimit: 5 * GB,
  },
  'did:web:lite.web3.storage': {
    name: 'Lite',
    limit: 100 * GB,
    egressLimit: 25 * GB,
  },
  'did:web:business.web3.storage': {
    name: 'Business',
    limit: 2 * TB,
    egressLimit: 500 * GB,
  },
  'did:web:free.web3.storage': {
    name: 'Free',
    limit: Infinity,
    egressLimit: Infinity,
  },

  // staging.web3.storage plans
  'did:web:starter.staging.web3.storage': {
    name: 'Staging Starter',
    limit: 5 * GB,
    egressLimit: 5 * GB,
  },
  'did:web:lite.staging.web3.storage': {
    name: 'Staging Lite',
    limit: 100 * GB,
    egressLimit: 25 * GB,
  },
  'did:web:business.staging.web3.storage': {
    name: 'Staging Business',
    limit: 2 * TB,
    egressLimit: 500 * GB,
  },
  'did:web:free.staging.web3.storage': {
    name: 'Free',
    limit: Infinity,
    egressLimit: Infinity,
  },

  // storacha.network plans
  'did:web:starter.storacha.network': {
    name: 'Mild',
    limit: 5 * GB,
    egressLimit: 5 * GB,
  },
  'did:web:lite.storacha.network': {
    name: 'Medium',
    limit: 100 * GB,
    egressLimit: 25 * GB,
  },
  'did:web:business.storacha.network': {
    name: 'Extra Spicy',
    limit: 2 * TB,
    egressLimit: 500 * GB,
  },
  'did:web:free.storacha.network': {
    name: 'Free',
    limit: Infinity,
    egressLimit: Infinity,
  },
  'did:web:trial.storacha.network': {
    name: 'Trial',
    limit: 100 * MB,
    egressLimit: 100 * MB,
  },
  
  // staging.storacha.network plans
  'did:web:starter.staging.storacha.network': {
    name: 'Staging Mild',
    limit: 5 * GB,
    egressLimit: 5 * GB,
  },
  'did:web:lite.staging.storacha.network': {
    name: 'Staging Medium',
    limit: 100 * GB,
    egressLimit: 25 * GB,
  },
  'did:web:business.staging.storacha.network': {
    name: 'Staging Extra Spicy',
    limit: 2 * TB,
    egressLimit: 500 * GB,
  },
  'did:web:free.staging.storacha.network': {
    name: 'Staging Free',
    limit: Infinity,
    egressLimit: Infinity,
  },
  'did:web:trial.staging.storacha.network': {
    name: 'Staging Trial',
    limit: 100 * MB,
    egressLimit: 100 * MB,
  },
}

const MAX_REFERRALS = 11
const MAX_CREDITS = 460

function ErrorComponent({ error }: { error: Error }) {
  const cause = error.cause as Error | undefined
  return (
    <div className="text-sm flex flex-col gap-4 border border-hot-red p-2 rounded w-full overflow-x-scroll">
      <div className="flex flex-row justify-between">
        <h3>Error: {error.message ?? 'No error message'}</h3>
        <CopyButton
          text={`${error.message}

${error.stack}

${cause?.stack}
`}
        />
      </div>
      {error.stack ? (
        <div>
          <h4 className="uppercase text-hot-red">Stacktrace</h4>
          <pre className="text-xs">{error.stack}</pre>
        </div>
      ) : (
        ''
      )}
      {cause?.stack ? (
        <div>
          <h4 className="uppercase text-hot-red">Cause</h4>
          <pre className="text-xs">{cause?.stack}</pre>
        </div>
      ) : (
        ''
      )}
    </div>
  )
}

function UsageInfo({ account }: { account: Account }) {
  const [{ client }] = useW3()

  const {
    data: usageData,
    error: usageError,
    isLoading: isUsageLoading,
  } = useSWR<{
    storage: Record<SpaceDID, number>
    egress: Record<SpaceDID, number>
    totalStorage: number
    totalEgress: number
  } | undefined>(`/usage/${account ?? ''}`, {
    fetcher: async () => {
      if (!account || !client) return

      const result = await client.capability.account.usage.get(account.did())
      return {
        storage: Object.entries(result.spaces).reduce((m, [spaceDID, value]) => {
          m[spaceDID as SpaceDID] = value.total
          return m
        }, {} as Record<SpaceDID, number>),
        egress: Object.entries(result.egress.spaces).reduce((m, [spaceDID, value]) => {
          m[spaceDID as SpaceDID] = value.total
          return m
        }, {} as Record<SpaceDID, number>),
        totalStorage: result.total,
        totalEgress: result.egress.total,
      }
    },
    onError: logAndCaptureError,
  })
  const {
    data: plan,
    error: planError,
    isLoading: isPlanLoading,
  } = usePlan(account)

  const product = plan?.product
  const planName =
    product && Plans[product] ? Plans[plan.product].name : 'Unknown'

  const allocated = usageData?.totalStorage ?? 0
  const limit = plan?.product ? Plans[plan.product]?.limit : 0
  const egressLimit = plan?.product ? Plans[plan.product]?.egressLimit : 0
  console.log("PLAN", plan)
  console.log("IS PLAN LOADING", isPlanLoading)
  return (
    <>
      <H2>{account.toEmail()}</H2>
      <H3>Plan</H3>
      {planError ? (
        <ErrorComponent error={planError} />
      ) : plan ? (
        <p className="font-epilogue mb-4">
          <span className="text-xl mr-2">{planName}</span>
          <Link className="underline text-sm" href="/plans/change">
            change
          </Link>
        </p>
      ) : isPlanLoading ? (
        <DefaultLoader className="w-6 h-6 inline-block" />
      ) : (
        <p>
          This should never be reached! If you see this message, please contact{' '}
          <a href="mailto:support@storacha.network">support@storacha.network</a>
        </p>
      )}
      <H2>Storage</H2>
      {usageError ? (
        <ErrorComponent error={usageError} />
      ) : usageData && limit ? (
        <>
          <p className="font-epilogue mb-4">
            <span className="text-xl">{filesize(allocated)}</span>
            <span className="text-sm">
              {' '}
              of {limit === Infinity ? 'Unlimited' : filesize(limit)}
            </span>
          </p>
          <table className="border-collapse table-fixed w-full">
            {Object.entries(usageData.storage)
              .sort((a, b) => b[1] - a[1])
              .map(([space, total]) => {
                return (
                  <tr
                    key={space}
                    className="border-b border-hot-red last:border-b-0"
                  >
                    <td className="text-xs font-mono py-2">
                      <Link href={`/space/${space}`}>{space}</Link>
                    </td>
                    <td className="text-xs text-right py-2">
                      {filesize(total)}
                    </td>
                  </tr>
                )
              })}
          </table>
        </>
      ) : isUsageLoading ? (
        <DefaultLoader className="w-6 h-6 inline-block" />
      ) : (
        <p>
          This should never be reached! If you see this message, please contact{' '}
          <a href="mailto:support@storacha.network">support@storacha.network</a>
        </p>
      )}
      <H2 className="mt-6">Egress This Month</H2>
      {usageError ? (
        <ErrorComponent error={usageError} />
      ) : usageData && egressLimit ? (
        <>
          <p className="font-epilogue mb-4">
            <span className="text-xl">{filesize(usageData.totalEgress)}</span>
            <span className="text-sm">
              {' '}
              of {egressLimit === Infinity ? 'Unlimited' : filesize(egressLimit)}
            </span>
          </p>
          <table className="border-collapse table-fixed w-full">
            {Object.entries(usageData.egress)
              .sort((a, b) => b[1] - a[1])
              .map(([space, total]) => {
                return (
                  <tr
                    key={space}
                    className="border-b border-hot-red last:border-b-0"
                  >
                    <td className="text-xs font-mono py-2">
                      <Link href={`/space/${space}`}>{space}</Link>
                    </td>
                    <td className="text-xs text-right py-2">
                      {filesize(total)}
                    </td>
                  </tr>
                )
              })}
          </table>
        </>
      ) : isUsageLoading ? (
        <DefaultLoader className="w-6 h-6 inline-block" />
      ) : (
        <p>
          This should never be reached! If you see this message, please contact{' '}
          <a href="mailto:support@storacha.network">support@storacha.network</a>
        </p>
      )}
    </>
  )
}

export default function SettingsPage(): JSX.Element {
  const [{ accounts }] = useW3()

  const {
    referrals,
    referralLink,
    setReferrerEmail,
    accountEmail,
    urlQueryEmail,
    createRefcode,
    mutateRefcode,
  } = useReferrals()

  const referred = referrals?.length || 0

  // TODO: need to calculate these from the referral information that gets added during the TBD cronjob
  const credits = 0
  const points = 0
  return (
    <>
      <SettingsNav />
      <H1>Settings</H1>
      <H2>Rewards</H2>
      <div className="flex flex-row space-x-2 justify-between max-w-4xl mb-4">
        <div className="border border-hot-red rounded-2xl bg-white p-5 flex-grow">
          <H3>Referred</H3>
          <span className="text-4xl">{referred}</span> / {MAX_REFERRALS}
        </div>
        <div className="border border-hot-red rounded-2xl bg-white p-5 flex-grow">
          <H3>USD Credits</H3>
          <span className="text-4xl">{credits}</span> / {MAX_CREDITS}
        </div>
        <div className="border border-hot-red rounded-2xl bg-white p-5 flex-grow">
          <H3>Racha Points</H3>
          <span className="text-4xl">{points}</span>
        </div>
      </div>
      <div className="border border-hot-red rounded-2xl bg-white p-5 max-w-4xl mb-4">
        <ReferralsList />
        {referralLink ? (
          <RefcodeLink referralLink={referralLink} />
        ) : (
          <RefcodeCreator
            accountEmail={accountEmail}
            urlQueryEmail={urlQueryEmail}
            createRefcode={createRefcode}
            mutateRefcode={mutateRefcode}
            setReferrerEmail={setReferrerEmail}
          />
        )}
      </div>
      <div className="border border-hot-red rounded-2xl bg-white p-5 max-w-4xl">
        {accounts.map((account) => (
          <UsageInfo account={account} key={account.did()} />
        ))}
      </div>
      <div className="border border-hot-red rounded-2xl bg-white p-5 max-w-4xl mt-4">
        <H2>Account Management</H2>
        <button
          onClick={() =>
            window.open('https://forms.gle/QsvfMip2qzJqzEEo9', '_blank')
          }
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          Request Account Deletion
        </button>
      </div>
    </>
  )
}

