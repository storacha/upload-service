'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useKeyring, Plan } from '@w3ui/react-keyring'

const B = 1024
const MB = 1024 * B
const GB = 1024 * MB
const TB = 1024 * GB
const BarHeight = 10

const PlanLimit: Record<`did:${string}`, number> = {
  'did:web:starter.web3.storage': 5 * GB,
  'did:web:lite.web3.storage': 100 * GB,
  'did:web:business.web3.storage': 2 * TB
}

const PlanNames: Record<`did:${string}`, string> = {
  'did:web:starter.web3.storage': 'Starter',
  'did:web:lite.web3.storage': 'Lite',
  'did:web:business.web3.storage': 'Business'
}

export function UsageBar (): ReactNode {
  const [{ account }, { getPlan }] = useKeyring()
  const [plan, setPlan] = useState<Plan>()
  const [usage, setUsage] = useState<Record<string, number>>()

  useEffect(() => {
    if (!account) return
    (async () => {
      if (account) {
        try {
          const result = await getPlan(account as `${string}@${string}`)
          if (result.error) throw new Error('getting plan', { cause: result.error })
          setPlan(result.ok)
        } catch (err) {
          console.error(err)
        }
      }
    })()
  }, [account, getPlan])

  useEffect(() => {
    if (!account) return
    // TODO: get usage by space
  }, [account])

  // if (!plan) setPlan({ product: 'did:web:starter.web3.storage' })
  // if (!usage) setUsage({
  //   'did:key:z6MkjCoKJcunQgzihb4tXBYDd9xunhpGNoC14HEypgAe5cNW': 500_000_000,
  //   'did:key:z6MketbAFtbeqDeVHxSzSSDH2PfMTquQ3vzZCcPFweXBGe3R': 200_000_000,
  //   'did:key:z6MkoEBnTj96thGj7H7c1DrdNHF4AiA9VPDRVqTmp4teYd6B': 78_000_000,
  // })

  const allocated = Object.values(usage ?? {}).reduce((total, n) => total + n, 0)
  const limit = plan?.product ? PlanLimit[plan.product] : null

  return (
    <div className='w-full'>
      {plan?.product ? (
        <div className='lg:text-right text-xs tracking-wider font-mono'>
          Plan: <strong>{PlanNames[plan.product] ?? plan.product}</strong> <a className='underline' href='mailto:support@web3.storage?subject=How%20to%20change%20my%20payment%20plan?' title='Automated support for switching plans is currently in progress. to change your plan, please email support@web3.storage.'>change</a>
        </div>
      ) : null}
      {usage && limit ? (
        <>
          <div className='rounded-full bg-white/20 overflow-hidden whitespace-nowrap outline outline-white/40 mt-3 mb-3 shadow-inner' style={{ fontSize: 0, height: BarHeight }}>
            {Object.entries(usage).sort((a, b) => b[1] - a[1]).map(([space, total]) => {
              return (
                <div
                  key={space}
                  style={{ width: `${total/limit * 100}%`, height: BarHeight }}
                  className='bg-white/80 hover:bg-white bg-clip-padding inline-block border-r last:border-r-0 border-transparent'
                  title={`${space}: ${filesize(total)}`}
                />
              )
            })}
          </div>
          <div className='lg:text-right text-xs tracking-wider uppercase font-bold font-mono'>
            <big>{filesize(allocated)}</big>
            <small> of {filesize(limit)}</small>
          </div>
        </>
      ) : null}
    </div>
  )
}

function filesize (bytes: number) {
  if (bytes < B / 2) return `${bytes}B` // avoid 0.0KB
  if (bytes < MB / 2) return `${(bytes / 1024).toFixed(1)}KB` // avoid 0.0MB
  if (bytes < GB / 2) return `${(bytes / 1024 / 1024).toFixed(1)}MB` // avoid 0.0GB
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
}
