import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { Delegation, Capabilities } from '@ucanto/interface'
import { DID } from '@ucanto/core'
import { useW3 } from './providers/Provider.js'
import type { SpaceDID, EmailAddress } from '@storacha/ui-core'

function isDID(value: string): boolean {
  try {
    DID.parse(value.trim())
    return true
  } catch {
    return false
  }
}

function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return !isDID(value) && emailRegex.test(value)
}

function truncateCID(cid: string): string {
  if (cid.length <= 14) return cid
  return `${cid.slice(0, 7)}...${cid.slice(-7)}`
}

async function checkDelegationRevoked(cid: string): Promise<boolean> {
  try {
    const serviceUrl = process.env.NEXT_PUBLIC_W3UP_SERVICE_URL
    if (!serviceUrl) {
      return false
    }
    const response = await fetch(`${serviceUrl}/revocations/${cid}`)
    return response.status === 200
  } catch {
    return false
  }
}

export interface SpaceShareProps {
  spaceDID: SpaceDID
}

export function SpaceShare({ spaceDID }: SpaceShareProps): JSX.Element {
  const [{ client }] = useW3()
  const [value, setValue] = useState('')
  const [shared, setShared] = useState<{
    audience: string
    capabilities: string[]
    delegation: Delegation<Capabilities>
    revoked?: boolean
  }[]>([])
  const [revoking, setRevoking] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (client && spaceDID) {
      setLoading(true)
      const delegations = client
        .delegations()
        .filter((d: Delegation<Capabilities>) => d.capabilities.some((c) => c.with === spaceDID))
        .map((d: Delegation<Capabilities>) => ({
          audience: d.audience.did(),
          capabilities: d.capabilities.map((c) => c.can),
          delegation: d,
          revoked: false,
        }))

      if (delegations.length === 0) {
        setShared([])
        setLoading(false)
        return
      }

      const check = async () => {
        const items = await Promise.all(
          delegations.map(async (entry) => ({
            ...entry,
            revoked: await checkDelegationRevoked(entry.delegation.cid.toString()),
          }))
        )
        setShared(items)
        setLoading(false)
      }
      void check()
    } else {
      setShared([])
      setLoading(false)
    }
  }, [client, spaceDID])

  async function shareViaEmail(email: string): Promise<void> {
    if (!client) throw new Error('Client not found')

    const space = client.spaces().find((s: any) => s.did() === spaceDID)
    if (!space) throw new Error('Could not find space to share')

    const existingRevoked = shared.find((item) => item.audience.toLowerCase().includes(email.toLowerCase()) && item.revoked)
    if (existingRevoked) {
      setError(`Cannot grant access to ${email}. This recipient has a previously revoked delegation.`)
      return
    }

    setError(null)
    const mail = email.trim() as EmailAddress
    const delegation: Delegation<Capabilities> = await client.shareSpace(mail, space.did())
    setShared((prev) => [
      ...prev,
      {
        audience: email,
        capabilities: delegation.capabilities.map((c) => c.can),
        delegation,
      },
    ])
    setValue('')
  }

  async function makeDownloadLink(did: string): Promise<string> {
    if (!client) throw new Error('missing client')
    const audience = DID.parse(did.trim())
    const delegation = await client.createDelegation(audience, [
      'space/*',
      'store/*',
      'upload/*',
      'access/*',
      'usage/*',
      'filecoin/*',
    ], { expiration: Infinity })
    const archiveRes = await delegation.archive()
    if (archiveRes.error) throw new Error('failed to archive delegation', { cause: archiveRes.error })
    const blob = new Blob([archiveRes.ok])
    return URL.createObjectURL(blob)
  }

  async function autoDownload(input: string): Promise<void> {
    const url = await makeDownloadLink(input)
    const link = document.createElement('a')
    link.href = url
    const [, method = '', id = ''] = input.split(':')
    link.download = method && id ? `did-${method}-${id.substring(0, 10)}.ucan` : 'delegation.ucan'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function revokeDelegation(key: string, delegation: Delegation<Capabilities>): Promise<void> {
    if (!client) throw new Error('Client not found')
    setRevoking((prev) => new Set([...prev, key]))
    await client.revokeDelegation(delegation.cid)
    setShared((prev) => prev.map((item) => (item.audience === key ? { ...item, revoked: true } : item)))
    setRevoking((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const active = useMemo(() => shared.filter((s) => !s.revoked), [shared])
  const revoked = useMemo(() => shared.filter((s) => s.revoked), [shared])

  return (
    <div className="max-w-4xl">
      <h2 className="text-sm font-bold uppercase">Share your space</h2>
      <div className="bg-white rounded-2xl border p-5">
        <p className="mb-4">Enter an Email or DID to share access or download a delegation:</p>
        <form onSubmit={(e) => { e.preventDefault(); if (isDID(value)) { void autoDownload(value) } else if (isEmail(value)) { void shareViaEmail(value) } }}>
          <input className="text-black py-2 px-2 rounded-xl block mb-4 border w-11/12" type="text" placeholder="email or did:" value={value} onChange={(e) => { setValue(e.target.value); if (error) setError(null) }} />
          <button type="submit" className={`inline-block border px-6 py-2 rounded-full text-sm ${isEmail(value) || isDID(value) ? '' : 'opacity-20'}`} disabled={!isEmail(value) && !isDID(value)}>
            {isEmail(value) ? 'Share via Email' : isDID(value) ? 'Download UCAN' : 'Enter a valid email or DID'}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-3 border rounded-md">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {(active.length > 0 || loading) && (
        <div className="bg-white rounded-2xl border p-5 mt-5">
          <p className="mb-4">Shared With:</p>
          {loading ? (
            <div className="flex items-center justify-center py-8"><span>Checking delegation status...</span></div>
          ) : (
            <ul>
              {active.map(({ audience, capabilities, delegation }, i) => {
                const key = audience
                const isRevoking = revoking.has(key)
                const cidString = delegation.cid.toString()
                return (
                  <li key={key} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1">
                    <div className="flex flex-col w-full">
                      <div className="flex items-center w-full">
                        <span className="truncate mt-1">{audience}</span>
                      </div>
                      <div className="flex items-center mt-1">
                        <span className="text-xs font-mono">{truncateCID(cidString)}</span>
                      </div>
                    </div>
                    <button onClick={() => { void revokeDelegation(key, delegation) }} disabled={isRevoking} className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-md ${isRevoking ? 'opacity-50' : ''}`}> {isRevoking ? 'Revoking…' : 'Revoke'} </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {revoked.length > 0 && (
        <div className="bg-gray-50 rounded-2xl border p-5 mt-5">
          <p className="mb-4">Revoked Access:</p>
          <ul>
            {revoked.map(({ audience, capabilities, delegation }) => {
              const cidString = delegation.cid.toString()
              return (
                <li key={audience} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1 opacity-75">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center w-full">
                      <span className="truncate mt-1 line-through">{audience}</span>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-xs font-mono">{truncateCID(cidString)}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium">Revoked</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}