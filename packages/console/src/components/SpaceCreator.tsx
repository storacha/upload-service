import type { ChangeEvent } from 'react'

import React, { useState } from 'react'
import { Space, useW3 } from '@w3ui/react'
import Loader from '../components/Loader'
import { DID, DIDKey } from '@ucanto/interface'
import { DidIcon } from './DidIcon'
import Link from 'next/link'

export function SpaceCreatorCreating (): JSX.Element {
  return (
    <div className='flex flex-col items-center space-y-4'>
      <h5>Creating Space...</h5>
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
      await account.provision(space.did(), { provider })

      await space.createRecovery(account.did())
      await space.save()

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
        <SpacePreview did={space.did()} name={space.name} />
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
        <input
          className='text-black py-2 px-2 rounded block w-full mb-4 border border-gray-800'
          placeholder='Name'
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value)
          }}
          required={true}
        />
        <button type='submit' className='inline-block bg-zinc-950 hover:outline text-white font-bold text-sm px-6 py-2 rounded-full whitespace-nowrap'>Create</button>
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
    <figure className='p-4 flex flex-row items-start gap-2 bg-zinc-950/10 hover:bg-white/10 rounded'>
      <Link href={`/space/${did}`} className='block'>
        <DidIcon did={did} />
      </Link>
      <figcaption className='grow'>
        <Link href={`/space/${did}`} className='block'>
          <span className='block text-lg font-semibold leading-5 mb-1'>
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
