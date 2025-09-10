import { ChangeEvent, useEffect, useState } from 'react'
import { SpaceDID, useW3 } from '@storacha/ui-react'
import { extract } from '@ucanto/core/delegation'
import type { PropsWithChildren } from 'react'
import type { Capabilities, Delegation } from '@ucanto/interface'
import { SpacePreview } from './components/SpaceCreator'
import { H2, H3 } from '@/components/Text'
import CopyButton from './components/CopyButton'
import Tooltip from './components/Tooltip'
import { ArrowDownOnSquareStackIcon, CloudArrowDownIcon, PaperAirplaneIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import * as DIDMailTo from '@storacha/did-mailto'
import { DID } from '@ucanto/core'
import { logAndCaptureError } from './sentry'

function Header(props: PropsWithChildren): JSX.Element {
  return (
    <H2 as='h3'>
      {props.children}
    </H2>
  )
}

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

export function ShareSpace({ spaceDID }: { spaceDID: SpaceDID }): JSX.Element {
  const [{ client, accounts }] = useW3()
  /** @type {Account | undefined} */
  const account = accounts[0]
  const [value, setValue] = useState('')
  const [sharedEmails, setSharedEmails] = useState<{ email: string, capabilities: string[], delegation: Delegation<Capabilities>, revoked?: boolean }[]>([])
  const [revokingEmails, setRevokingEmails] = useState<Set<string>>(new Set())
  const [loadingSharedEmails, setLoadingSharedEmails] = useState(false)

  const updateSharedEmails = (delegations: { email: string, capabilities: string[], delegation: Delegation<Capabilities>, revoked?: boolean }[]) => {
    setSharedEmails(prev => {
      const newEmails = delegations.filter(d => !prev.some(item => item.email === d.email))
      return [...prev, ...newEmails]
    })
  }

  useEffect(() => {
    if (client && spaceDID) {
      setLoadingSharedEmails(true)
      
      // Find all delegations via email where the spaceDID is present
      const delegations = client.delegations()
        .filter(d => d.capabilities.some(c => c.with === spaceDID))
        .filter(d => d.audience.did().startsWith('did:mailto:'))
        .map(d => ({
          email: DIDMailTo.toEmail(DIDMailTo.fromString(d.audience.did())),
          capabilities: d.capabilities.map(c => c.can),
          delegation: d,
          revoked: false // Will be updated after checking revocation status
        }))
      
      // If no delegations found, stop loading immediately
      if (delegations.length === 0) {
        setSharedEmails([])
        setLoadingSharedEmails(false)
        return
      }
      
      // Check revocation status for each delegation
      const checkRevocationStatus = async () => {
        try {
          const delegationsWithStatus = await Promise.all(
            delegations.map(async (delegation) => {
              const isRevoked = await checkDelegationRevoked(delegation.delegation.cid.toString())
              return { ...delegation, revoked: isRevoked }
            })
          )
          setSharedEmails(delegationsWithStatus)
        } catch (error) {
          console.error('Error checking delegation statuses:', error)
          // Fallback to showing delegations without revocation status
          setSharedEmails(delegations)
        } finally {
          setLoadingSharedEmails(false)
        }
      }
      
      void checkRevocationStatus()
    } else {
      setSharedEmails([])
      setLoadingSharedEmails(false)
    }
  }, [client, spaceDID])

  /**
   * Delegations directly to the user did:mailto can be revoked by the agent who delegated it.
   * 
   */
  async function shareViaEmail(email: string): Promise<void> {
    if (!client) {
      throw new Error(`Client not found`)
    }

    const space = client.spaces().find(s => s.did() === spaceDID)
    if (!space) {
      throw new Error(`Could not find space to share`)
    }

    const delegatedEmail = DIDMailTo.email(email)
    const delegation: Delegation<Capabilities> = await client.shareSpace(delegatedEmail, space.did())
    const next = { email: delegatedEmail, capabilities: delegation.capabilities.map(c => c.can), delegation }
    updateSharedEmails([next])
    setValue('')
  }

  async function makeDownloadLink(did: string): Promise<string> {
    try {
      if (!client)
        throw new Error('missing w3up client')

      const audience = DID.parse(did.trim())
      const delegation = await client.createDelegation(audience, [
        'space/*',
        'store/*',
        'upload/*',
        'access/*',
        'usage/*',
        'filecoin/*',
      ], {
        expiration: Infinity,
      })

      const archiveRes = await delegation.archive()
      if (archiveRes.error) {
        throw new Error('failed to archive delegation', { cause: archiveRes.error })
      }
      const blob = new Blob([archiveRes.ok])
      const url = URL.createObjectURL(blob)
      return url
    } catch (err: any) {
      throw new Error(err.message ?? err, { cause: err })
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (isDID(value)) {
      void autoDownload(value)
    } else if (isEmail(value)) {
      void shareViaEmail(value)
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>): void {
    const input = e.target.value
    setValue(input)
  }

  function downloadName(ready: boolean, inputDid: string): string {
    if (!ready || inputDid === '') return ''
    const [, method = '', id = ''] = inputDid.split(':')
    return `did-${method}-${id?.substring(0, 10)}.ucan`
  }

  async function autoDownload(value: string): Promise<void> {
    const resourceURL = await makeDownloadLink(value)
    const link = document.createElement('a')
    link.href = resourceURL
    link.download = downloadName(true, value)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function checkDelegationRevoked(cid: string): Promise<boolean> {
    try {
      const serviceUrl = process.env.NEXT_PUBLIC_W3UP_SERVICE_URL
      if (!serviceUrl) {
        console.warn('NEXT_PUBLIC_W3UP_SERVICE_URL not configured, assuming delegation is not revoked')
        return false
      }

      const response = await fetch(`${serviceUrl}/revocations/${cid}`)
      return response.status === 200
    } catch (error) {
      console.warn('Failed to check delegation revocation status:', error)
      return false // Assume not revoked if we can't check
    }
  }

  async function revokeDelegation(email: string, delegation: Delegation<Capabilities>): Promise<void> {
    if (!client) {
      throw new Error('Client not found')
    }

    try {
      setRevokingEmails(prev => new Set([...prev, email]))
      await client.revokeDelegation(delegation.cid)
      
      // Mark the delegation as revoked instead of removing it
      setSharedEmails(prev => prev.map(item => 
        item.email === email ? { ...item, revoked: true } : item
      ))
    } catch (error) {
      logAndCaptureError(error)
      throw error
    } finally {
      setRevokingEmails(prev => {
        const next = new Set(prev)
        next.delete(email)
        return next
      })
    }
  }

  // Helper function to truncate CID for display
  function truncateCID(cid: string): string {
    if (cid.length <= 14) return cid
    return `${cid.slice(0, 7)}...${cid.slice(-7)}`
  }

  // Separate active and revoked delegations
  const activeDelegations = sharedEmails.filter(item => !item.revoked)
  const revokedDelegations = sharedEmails.filter(item => item.revoked)

  return (
    <div className='max-w-4xl'>
      <Header>Share your space</Header>
      <div className='bg-white rounded-2xl border border-hot-red p-5 font-epilogue'>
        <p className='mb-4'>
          Ask your friend for their Email or Decentralized Identifier (DID) and paste it
          below:
        </p>
        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            void onSubmit(e)
          }}
        >
          <input
            className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-11/12'
            type='text'
            placeholder='email or did:'
            value={value}
            onChange={onChange}
            required={true}
          />
          <button
            type='submit'
            className={`inline-block bg-hot-red border border-hot-red ${isEmail(value) || isDID(value) ? 'hover:bg-white hover:text-hot-red' : 'opacity-20'} font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap`}
            onClick={async (e) => {
              e.preventDefault()
              if (isEmail(value)) {
                await shareViaEmail(value)
              } else if (isDID(value)) {
                await autoDownload(value)
              }
            }}
            disabled={!isEmail(value) && !isDID(value)}
          >
            {isEmail(value) ? 'Share via Email' : isDID(value) ? (
              <>
                <CloudArrowDownIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} />
                {'Download UCAN'}
              </>
            ) : 'Enter a valid email or DID'}
          </button>
        </form>


      </div>
      {/* Active Delegations Panel */}
      {(activeDelegations.length > 0 || loadingSharedEmails) && (
        <div className='bg-white rounded-2xl border border-hot-red p-5 mt-5 font-epilogue'>
          <p className='mb-4'>
            Shared With:
          </p>
          {loadingSharedEmails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-red mr-3"></div>
              <span className="text-gray-600">Checking delegation status...</span>
            </div>
          ) : (
            <ul>
            {activeDelegations.map(({ email, capabilities, delegation }, i) => {
              const isRevoking = revokingEmails.has(email)
              const cidString = delegation.cid.toString()
              return (
                <li key={email} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center w-full">
                      <span className="truncate mt-1">{email}</span>
                      <InformationCircleIcon className={`h-5 w-5 ml-1 share-capabilities-${i}`} />
                      <Tooltip anchorSelect={`.share-capabilities-${i}`}>
                        <H3>Capabilities</H3>
                        {capabilities.map((c, j) => (
                          <p key={j}>{c}</p>
                        ))}
                      </Tooltip>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-xs text-gray-500 font-mono">{truncateCID(cidString)}</span>
                      <div className="ml-2">
                        <CopyButton text={cidString}>
                          <span className="text-xs"></span>
                        </CopyButton>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await revokeDelegation(email, delegation)
                      } catch (error) {
                        console.error('Failed to revoke delegation:', error)
                      }
                    }}
                    disabled={isRevoking}
                    className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      isRevoking 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                    title="Revoke access for this email"
                  >
                    {isRevoking ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-1"></div>
                        Revoking...
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="h-4 w-4 mr-1" />
                        Revoke
                      </>
                    )}
                  </button>
                </li>
              )
            })}
            </ul>
          )}
        </div>
      )}

      {/* Revoked Delegations Panel */}
      {revokedDelegations.length > 0 && (
        <div className='bg-gray-50 rounded-2xl border border-gray-300 p-5 mt-5 font-epilogue'>
          <p className='mb-4 text-gray-700'>
            Revoked Access:
          </p>
          <ul>
            {revokedDelegations.map(({ email, capabilities, delegation }, i) => {
              const cidString = delegation.cid.toString()
              return (
                <li key={email} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1 opacity-75">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center w-full">
                      <span className="truncate mt-1 line-through text-gray-500">{email}</span>
                      <InformationCircleIcon className={`h-5 w-5 ml-1 text-gray-400 revoked-capabilities-${i}`} />
                      <Tooltip anchorSelect={`.revoked-capabilities-${i}`}>
                        <H3>Capabilities (Revoked)</H3>
                        {capabilities.map((c, j) => (
                          <p key={j} className="text-gray-500">{c}</p>
                        ))}
                      </Tooltip>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-xs text-gray-400 font-mono">{truncateCID(cidString)}</span>
                      <div className="ml-2">
                        <CopyButton text={cidString}>
                          <span className="text-xs text-gray-500"></span>
                        </CopyButton>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-500 bg-gray-200 rounded-md">
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Revoked
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ImportSpace() {
  const [{ client }] = useW3()
  const [proof, setProof] = useState<Delegation>()

  async function onImport(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = e.target.files?.[0]
    if (!client || input === undefined) return
    let delegation
    try {
      const res = await extract(new Uint8Array(await input.arrayBuffer()))
      if (res.error) {
        throw new Error('failed to extract delegation', { cause: res.error })
      }
      delegation = res.ok
    } catch (err) {
      logAndCaptureError(err)
      return
    }
    try {
      await client.addSpace(delegation)
      setProof(delegation)
    } catch (err) {
      logAndCaptureError(err)
    }
  }

  const body = `Please send me a UCAN delegation to access to your space. My agent DID is:\n\n${client?.did()}`
    .replace(/ /g, '%20')
    .replace(/\n/g, '%0A')

  return (
    <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
      <ol className='list-decimal ml-4 text-hot-red'>
        <li className='mt-4 mb-8'>
          Send your DID to your friend.
          <div className='font-mono text-sm text-black break-words my-4'>
            {client?.did()}
          </div>
          <CopyButton text={client?.did() ?? ''}>Copy DID</CopyButton>
          <a href={`mailto:?subject=Space%20Access%20Request&body=${body}`} className={`inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm ml-2 px-6 py-2 rounded-full whitespace-nowrap`}>
            <PaperAirplaneIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} /> Email DID
          </a>
        </li>
        <li className='mt-4 my-8'>
          Import the UCAN they send you.
          <p className='text-black my-2'>Instruct your friend to use the web console or CLI to create a UCAN, delegating your DID acces to their space.</p>
          <div className='mt-4'>
            <label className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap cursor-pointer'>
              <ArrowDownOnSquareStackIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{ marginTop: -4 }} />
              Import UCAN
              <input
                type='file'
                accept='.ucan,.car,application/vnd.ipfs.car'
                className='hidden'
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  void onImport(e)
                }}
              />
            </label>
          </div>
        </li>
      </ol>
      {proof && proof.capabilities && proof.capabilities.length > 0 && (
        <div className='mt-4 pt-4'>
          <Header>Added</Header>
          <div className='max-w-3xl border border-hot-red rounded-2xl'>
            <SpacePreview
              did={proof.capabilities[0].with}
              name={proof.facts[0]?.space.name}
              capabilities={proof.capabilities.map(c => c.can)}
              key={proof.capabilities[0].with} />
          </div>
        </div>
      )}
    </div>
  )
}
