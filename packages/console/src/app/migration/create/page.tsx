'use client'

import { MouseEventHandler, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { H1, H2 } from '@/components/Text'
import { useMigrations } from '@/components/MigrationsProvider'
import { DIDKey, useW3 } from '@w3ui/react'
import * as NFTStorageMigrator from '@/lib/migrations/nft-storage'
import * as Web3StorageMigrator from '@/lib/migrations/web3-storage'
import { DidIcon } from '@/components/DidIcon'
import { MigrationConfiguration, MigrationSource } from '@/lib/migrations/api'

interface WizardProps {
  config: Partial<MigrationConfiguration>
  onPrev: () => void
  onNext: (config: Partial<MigrationConfiguration>) => void
}

const steps = [
  ChooseSource,
  AddSourceToken,
  ChooseTargetSpace,
  Confirmation
]

export default function CreateMigrationPage (): JSX.Element {
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState<Partial<MigrationConfiguration>>({})
  const router = useRouter()
  const [, { createMigration, startMigration }] = useMigrations()

  const Component = steps[step]
  const handlePrev = () => setStep(Math.max(0, step - 1))
  const handleNext = (c: Partial<MigrationConfiguration>) => {
    if (step === steps.length - 1) {
      const { id } = createMigration(c as MigrationConfiguration)
      startMigration(id)
      router.replace(`/migration/${id}`)
    } else {
      setConfig(c)
      setStep(step + 1)
    }
  }
  return <Component config={config} onPrev={handlePrev} onNext={handleNext} />
}

function ChooseSource ({ config, onNext }: WizardProps) {
  const [source, setSource] = useState<MigrationSource|undefined>(config.source)
  const handleNextClick: MouseEventHandler = e => {
    e.preventDefault()
    if (!source) return
    onNext({ ...config, source })
  }

  return (
    <div>
      <H1>Create a new migration</H1>
      <p className='mb-8'>This allows data to be migrated from a previous provider to one of your spaces.</p>

      <H2>Where from?</H2>
      <p className='mb-4'>Pick a storage service you want to migrate data from.</p>
      <div className='mb-4'>
        <button className={`bg-white/60 rounded-lg shadow-md p-8 hover:outline mr-4 ${source === 'classic.nft.storage' ? 'outline' : ''}`} type='button' onClick={() => setSource('classic.nft.storage')} title='Migrate from NFT.Storage (Classic)'>
          <img src='/nftstorage-logo.png' width='360' />
        </button>
        <button className={`bg-white/60 opacity-60 rounded-lg shadow-md p-8 ${source === 'old.web3.storage' ? 'outline' : ''}`} type='button' onClick={() => setSource('old.web3.storage')} title='COMING SOON! Migrate from Web3.Storage (Old)' disabled={true}>
          <img src='/web3storage-logo.png' width='360' />
        </button>
      </div>
      <button onClick={handleNextClick} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap hover:outline ${source ? '' : 'opacity-10'}`} disabled={!source}>
        Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
      </button>
    </div>
  )
}

function AddSourceToken ({ config, onNext, onPrev }: WizardProps) {
  const [token, setToken] = useState<string|undefined>(config.token)
  const [error, setError] = useState('')

  const handleNextClick: MouseEventHandler = async e => {
    e.preventDefault()
    if (!token) return
    setError('')

    try {
      if (config.source === 'classic.nft.storage') {
        await NFTStorageMigrator.checkToken(token)
      } else if (config.source === 'old.web3.storage') {
        await Web3StorageMigrator.checkToken(token)
      } else {
        throw new Error(`unknown data source: ${config.source}`)
      }
    } catch (err: any) {
      console.error(err)
      return setError(`Error using token: ${err.message}`)
    }
    onNext({ ...config, token })
  }
  return (
    <div>
      <H1>Add data source token</H1>
      <p className='mb-8'>Add your <strong>{config.source}</strong> API token. Note: the key never leaves this device, it is for local use only by the migration tool.</p>
      <H1>API Token</H1>
      <div className='max-w-xl mb-4'>
        <input
          type='password'
          className='text-black py-2 px-2 rounded block w-full border border-gray-800'
          placeholder='eyJhb...'
          value={token ?? ''}
          onChange={e => setToken(e.target.value)}
          required={true}
        />
        <p className='text-xs text-red-700'>{error}</p>
      </div>
      <button onClick={e => { e.preventDefault(); onPrev() }} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-3 pr-6 py-2 mr-3 rounded-full whitespace-nowrap hover:outline`}>
        <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
      </button>
      <button onClick={handleNextClick} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap hover:outline ${token ? '' : 'opacity-10'}`} disabled={!token}>
        Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
      </button>
    </div>
  )
}

function ChooseTargetSpace ({ config, onNext, onPrev }: WizardProps) {
  const [{ spaces }] = useW3()
  const [space, setSpace] = useState<DIDKey|undefined>(config.space)

  const handleNextClick: MouseEventHandler = async e => {
    e.preventDefault()
    if (!space) return
    onNext({ ...config, space })
  }
  return (
    <div>
      <H1>Target space</H1>
      <p className='mb-8'>Choose an existing space to migrate data to.</p>
      <H2>Space</H2>
      <div className='max-w-lg mb-4 border rounded-md border-zinc-700'>
        {spaces.map(s => (
          <button
            key={s.did()}
            type='button'
            className={`flex flex-row items-start gap-2 p-3 text-white text-left border-b last:border-0 border-zinc-700 w-full ${s.did() === space ? 'bg-gray-900/60' : 'bg-gray-900/30 hover:bg-gray-900/50'}`}
            onClick={() => setSpace(s.did())}>
            <DidIcon did={s.did()} />
            <div className='grow overflow-hidden whitespace-nowrap text-ellipsis'>
              <span className='text-md font-semibold leading-5 m-0'>
                {s.name || 'Untitled'}
              </span>
              <span className='font-mono text-xs block'>
                {s.did()}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button onClick={e => { e.preventDefault(); onPrev() }} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-3 pr-6 py-2 mr-3 rounded-full whitespace-nowrap hover:outline`}>
        <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
      </button>
      <button onClick={handleNextClick} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap hover:outline ${space ? '' : 'opacity-10'}`} disabled={!space}>
        Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
      </button>
    </div>
  )
}

function Confirmation ({ config, onNext, onPrev }: WizardProps) {
  const [{ spaces }] = useW3()
  const space = spaces.find(s => s.did() === config.space)
  if (!space) return

  const handleNextClick: MouseEventHandler = async e => {
    e.preventDefault()
    onNext(config)
  }
  return (
    <div>
      <H1>Ready to start!</H1>
      <p className='mb-8'>Make sure these details are correct before starting the migration.</p>
      <H2>Source</H2>
      <div className={`bg-white/60 rounded-lg shadow-md p-8 mb-4 inline-block`} title='Web3.Storage (Old)'>
        <img src={config.source === 'old.web3.storage' ? '/web3storage-logo.png' : '/nftstorage-logo.png'} width='360' />
      </div>
      <H2>Target</H2>
      <div className='max-w-lg mb-8 border rounded-md border-zinc-700'>
        <div className={`flex flex-row items-start gap-2 p-3 text-white text-left border-b last:border-0 border-zinc-700 w-full bg-gray-900/30`}>
          <DidIcon did={space.did()} />
          <div className='grow overflow-hidden whitespace-nowrap text-ellipsis'>
            <span className='text-md font-semibold leading-5 m-0'>
              {space.name || 'Untitled'}
            </span>
            <span className='font-mono text-xs block'>
              {space.did()}
            </span>
          </div>
        </div>
      </div>

      <button onClick={e => { e.preventDefault(); onPrev() }} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-3 pr-6 py-2 mr-3 rounded-full whitespace-nowrap hover:outline`}>
        <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle'/> Previous
      </button>
      <button onClick={handleNextClick} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-6 pr-3 py-2 rounded-full whitespace-nowrap hover:outline ${space ? '' : 'opacity-10'}`} disabled={!space}>
        Start <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle'/>
      </button>
    </div>
  )
}
