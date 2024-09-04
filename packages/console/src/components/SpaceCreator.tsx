import type { ChangeEvent } from 'react'

import React, { useState } from 'react'
import { Space, useW3 } from '@w3ui/react'
import Loader from '../components/Loader'
import { DID, DIDKey } from '@ucanto/interface'
import { DidIcon } from './DidIcon'
import Link from 'next/link'
import { FolderPlusIcon } from '@heroicons/react/24/outline'

export function SpaceCreatorCreating (): JSX.Element {
  return (
    <div className='flex flex-col items-center space-y-4'>
      <h5 className='font-epilogue'>Creating Space...</h5>
      <Loader className='w-6' />
    </div>
  )
}

interface SpaceCreatorFormProps {
  className?: string
}

export function SpaceCreatorForm ({
  className = ''
}: SpaceCreatorFormProps): JSX.Element {
  const [{ client, accounts }] = useW3()
  const [submitted, setSubmitted] = useState(false)
  const [created, setCreated] = useState(false)
  const [name, setName] = useState('')
  const [space, setSpace] = useState<Space>()

  function resetForm (): void {
    setName('')
  }

  async function onSubmit (e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!client) return
    // TODO: account selection
    const account = accounts[0]
    if (!account) {
      throw new Error('cannot create space, no account found, have you authorized your email?')
    }

    const { ok: plan } = await account.plan.get()
    if (!plan) {
      throw new Error('a payment plan is required on account to provision a new space.')
    }

    setSubmitted(true)
    try {
      const space = await client.createSpace(name)

      const provider = (process.env.NEXT_PUBLIC_W3UP_PROVIDER || 'did:web:web3.storage') as DID<'web'>
      const result = await account.provision(space.did(), { provider })
      if (result.error) {
        setSubmitted(false)
        setCreated(false)
        throw new Error(`failed provisioning space: ${space.did()} with provider: ${provider}`, { cause: result.error })
      }

      // MUST do this before creating recovery, as it creates necessary authorizations
      await space.save()

      // TODO this should have its own UX, like the CLI does, which would allow us to handle errors
      const recovery = await space.createRecovery(account.did())

      // TODO we are currently ignoring the result of this because we have no good way to handle errors - revamp this ASAP!
      await client.capability.access.delegate({
        space: space.did(),
        delegations: [recovery],
      })

      setSpace(client.spaces().find(s => s.did() === space.did()))
      setCreated(true)
      resetForm()
    } catch (error) {
      /* eslint-disable-next-line no-console */
      console.error(error)
      throw new Error('failed to create space', { cause: error })
    }
  }

  if (created && space) {
    return (
      <div className={className}>
        <div className='max-w-3xl border border-hot-red rounded-2xl'>
          <SpacePreview did={space.did()} name={space.name} />
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={className}>
        <SpaceCreatorCreating />
      </div>
    )
  }

  return (
    <div className={className}>
      <form className='' onSubmit={(e: React.FormEvent<HTMLFormElement>) => { void onSubmit(e) }}>
        <label className='block mb-2 uppercase text-xs text-hot-red font-epilogue m-1' htmlFor='space-name'>Name</label>
        <input
          id='space-name'
          className='text-black py-2 px-2 rounded-xl block mb-4 border border-hot-red w-80'
          placeholder='Name'
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value)
          }}
          required={true}
        />
        <button type='submit' className={`inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap`}>
          <FolderPlusIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Create
        </button>
      </form>
    </div>
  )
}

interface SpaceCreatorProps {
  className?: string
}

export function SpaceCreator ({
  className = ''
}: SpaceCreatorProps): JSX.Element {
  const [creating, setCreating] = useState(false)

  return (
    <div className={`${className}`}>
      {creating
        ? (
          <SpaceCreatorForm />
        )
        : (
          <button
            className='w3ui-button py-2'
            onClick={() => { setCreating(true) }}
          >
            Add Space
          </button>
        )}
    </div>
  )
  /* eslint-enable no-nested-ternary */
}

export function SpacePreview ({ did, name }: { did: DIDKey, name?: string }) {
  return (
    <figure className='p-4 flex flex-row items-start gap-2 rounded'>
      <Link href={`/space/${did}`} className='block'>
        <DidIcon did={did} />
      </Link>
      <figcaption className='grow'>
        <Link href={`/space/${did}`} className='block'>
          <span className='font-epilogue text-lg text-hot-red font-semibold leading-5 m-0'>
            { name ?? 'Untitled'}
          </span>
          <span className='block font-mono text-xs truncate'>
            {did}
          </span>
        </Link>
      </figcaption>
      <div>
        <Link href={`/space/${did}`} className='text-sm font-semibold align-[-8px] hover:underline'>
          View
        </Link>
      </div>
    </figure>
  )
}
