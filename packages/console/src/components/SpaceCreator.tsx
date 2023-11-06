import type { ChangeEvent } from 'react'

import React, { useState } from 'react'
import { useKeyring } from '@w3ui/react-keyring'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
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
  const [{ account, space }, { createSpace, registerSpace }] = useKeyring()
  const [submitted, setSubmitted] = useState(false)
  const [created, setCreated] = useState(false)
  const [name, setName] = useState('')

  function resetForm (): void {
    setName('')
  }

  async function onSubmit (e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (account) {
      setSubmitted(true)
      try {
        const did = await createSpace(name)
        await registerSpace(account, { provider: (process.env.NEXT_PUBLIC_W3UP_PROVIDER || 'did:web:web3.storage') as DID<'web'> })
        setCreated(true)
        resetForm()
      } catch (error) {
        /* eslint-disable no-console */
        console.error(error)
        /* eslint-enable no-console */
        throw new Error('failed to register', { cause: error })
      }
    } else {
      throw new Error('cannot create space, no account found, have you authorized your email?')
    }
  }

  if (created) {
    return (
      <div className={className}>
        <SpacePreview did={space.did()} name={space.name()} />
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
          className='text-black py-1 px-2 rounded block w-full mb-4'
          placeholder='Name'
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setName(e.target.value)
          }}
        />
        <button type='submit' className='w3ui-button'>Create</button>
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
    <figure className='p-4 flex flex-row items-start gap-2'>
      <Link href={`/space/${did}`} className='block'>
        <DidIcon did={did} />
      </Link>
      <figcaption className='grow'>
        <Link href={`/space/${did}`} className='block'>
          <span className='block text-lg font-semibold leading-5 mb-1'>
            { name ?? 'Untitled'}
          </span>
          <span className='block font-mono text-xs text-gray-500 truncate'>
            {did}
          </span>
        </Link>
      </figcaption>
      <div>
        <Link href={`/space/${did}`} className='text-sm font-semibold align-[-8px] hover:text-blue-400'>
          View
        </Link>
      </div>
    </figure>
  )
}
