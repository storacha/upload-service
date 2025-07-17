import type { ChangeEvent } from 'react'
import React, { useState, useCallback, useEffect } from 'react'
import { ContentServeService, Space, useW3 } from '@storacha/ui-react'
import Loader from '../components/Loader'
import { DIDKey } from '@ucanto/interface'
import { DidIcon } from './DidIcon'
import Link from 'next/link'
import { FolderPlusIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import Tooltip from './Tooltip'
import { H3 } from './Text'
import * as UcantoClient from '@ucanto/client'
import { HTTP } from '@ucanto/transport'
import * as CAR from '@ucanto/transport/car'
import { gatewayHost } from './services'
import { logAndCaptureError } from '@/sentry'

export function SpaceCreatorCreating(): JSX.Element {
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

export function SpaceCreatorForm({
  className = ''
}: SpaceCreatorFormProps): JSX.Element {
  const [{ client, accounts }] = useW3()
  const [submitted, setSubmitted] = useState(false)
  const [created, setCreated] = useState(false)
  const [name, setName] = useState('')
  const [space, setSpace] = useState<Space>()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    // Cleanup function
    return () => {
      mounted = false
      setSubmitted(false)
      setCreated(false)
      setError(null)
      setIsLoading(false)
    }
  }, [])

  const resetForm = useCallback((): void => {
    setName('')
    setError(null)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!client) {
      setError('Client not initialized')
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      const newSpace = await client.createSpace(name)
      if (newSpace) {
        setSpace(newSpace)
        setCreated(true)
      } else {
        throw new Error('Failed to create space')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while creating the space')
      // Log to proper logging service if available
      if (typeof window !== 'undefined' && window.errorReporter) {
        window.errorReporter.captureException(err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [client, name])

  if (created && space) {
    return <SpaceCreated space={space} />
  }

  return (
    <form onSubmit={handleSubmit} className={`space-creator-form ${className}`}>
      <div className="mb-4">
        <label htmlFor="space-name" className="block text-sm font-medium text-gray-700">
          Space Name
        </label>
        <input
          type="text"
          id="space-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-hot-red focus:ring-hot-red sm:text-sm"
          placeholder="Enter space name"
          required
          disabled={isLoading}
        />
        {error && (
          <p className="mt-2 text-sm text-red-600" id="space-error">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className={`inline-flex justify-center rounded-md border border-transparent bg-hot-red px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-hot-red focus:ring-offset-2 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Creating...' : 'Create Space'}
        </button>
      </div>
    </form>
  )
}

interface SpaceCreatorProps {
  className?: string
}

export function SpaceCreator({
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

interface SpacePreviewProps {
  did: DIDKey
  name?: string
  capabilities: string[]
}

export function SpacePreview({ did, name, capabilities }: SpacePreviewProps) {
  return (
    <figure className='p-4 flex flex-row items-start gap-2 rounded'>
      <Link href={`/space/${did}`} className='block'>
        <DidIcon did={did} />
      </Link>
      <figcaption className='grow'>
        <Link href={`/space/${did}`} className='block'>
          <span className='font-epilogue text-lg text-hot-red font-semibold leading-5 m-0 flex items-center'>
            {name ?? 'Untitled'}
            <InformationCircleIcon className={`h-5 w-5 ml-2 space-preview-capability-icon`} />
            <Tooltip anchorSelect={`.space-preview-capability-icon`}>
              <H3>Capabilities</H3>
              {capabilities.map((c, i) => (
                <p key={i}>{c}</p>
              ))}
            </Tooltip>
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
