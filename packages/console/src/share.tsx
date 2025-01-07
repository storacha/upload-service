import { ChangeEvent, useEffect, useState } from 'react'
import { SpaceDID, useW3 } from '@w3ui/react'
import { extract } from '@ucanto/core/delegation'
import type { PropsWithChildren } from 'react'
import type { Capabilities, Delegation } from '@ucanto/interface'
import { SpacePreview } from './components/SpaceCreator'
import { H2, H3 } from '@/components/Text'
import CopyButton from './components/CopyButton'
import Tooltip from './components/Tooltip'
import { ArrowDownOnSquareStackIcon, CloudArrowDownIcon, PaperAirplaneIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import * as DIDMailTo from '@web3-storage/did-mailto'
import { DID } from '@ucanto/core'

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
  const [{ client }] = useW3()
  const [value, setValue] = useState('')
  const [sharedEmails, setSharedEmails] = useState<{ email: string, capabilities: string[] }[]>([])

  const updateSharedEmails = (delegations: { email: string, capabilities: string[] }[]) => {
    setSharedEmails(prev => {
      const newEmails = delegations.filter(d => !prev.some(item => item.email === d.email))
      return [...prev, ...newEmails]
    })
  }

  useEffect(() => {
    if (client && spaceDID) {
      // Find all delegations via email where the spaceDID is present
      const delegations = client.delegations()
        .filter(d => d.capabilities.some(c => c.with === spaceDID))
        .filter(d => d.audience.did().startsWith('did:mailto:'))
        .map(d => ({
          email: DIDMailTo.toEmail(DIDMailTo.fromString(d.audience.did())),
          capabilities: d.capabilities.map(c => c.can)
        }))
      updateSharedEmails(delegations)
    }
  }, [client, spaceDID])

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
    const next = { email: delegatedEmail, capabilities: delegation.capabilities.map(c => c.can) }
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
        // @ts-expect-error (FIXME: https://github.com/storacha/w3up/issues/1554)
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
      {sharedEmails.length > 0 && (
        <div className='bg-white rounded-2xl border border-hot-red p-5 mt-5 font-epilogue'>
          <p className='mb-4'>
            Shared With:
          </p>
          <ul>
            {sharedEmails.map(({ email, capabilities }, i) => (
              <li key={email} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full mt-1">
                <span className="flex items-center w-full">
                  <span className="truncate mt-1">{email}</span>
                  <InformationCircleIcon className={`h-5 w-5 ml-1 share-capabilities-${i}`} />
                  <Tooltip anchorSelect={`.share-capabilities-${i}`}>
                    <H3>Capabilities</H3>
                    {capabilities.map((c, j) => (
                      <p key={j}>{c}</p>
                    ))}
                  </Tooltip>
                </span>
              </li>
            ))}
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
      console.error(err)
      return
    }
    try {
      await client.addSpace(delegation)
      setProof(delegation)
    } catch (err) {
      console.error(err)
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
