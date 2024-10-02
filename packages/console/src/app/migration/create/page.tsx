'use client'

import { MouseEventHandler, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { H1, H2 } from '@/components/Text'
import { useMigrations } from '@/components/MigrationsProvider'
import { DIDKey, useW3 } from '@w3ui/react'
import { DidIcon } from '@/components/DidIcon'
import { MigrationConfiguration, DataSourceID } from '@/lib/migrations/api'
import { dataSources } from '@/app/migration/data-sources'

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
  const [source, setSource] = useState<DataSourceID|undefined>(config.source)
  const handleNextClick: MouseEventHandler = e => {
    e.preventDefault()
    if (!source) return
    onNext({ ...config, source })
  }

  return (
    <div className='max-w-4xl'>
      <H1>Create a new migration</H1>
      <div className='bg-white my-4 p-5 rounded-2xl border border-hot-red font-epilogue'>
        <p className='mb-8'>This tool allows data to be migrated from a previous provider to one of your spaces.</p>
        <H2>Where from?</H2>
        <p className='mb-4'>Pick a storage service you want to migrate data from.</p>
        <div className='mb-4 text-center'>
          {dataSources.map(({ name, logo, source: { id } }) => (
            <button key={id} className={`bg-white/60 rounded-lg shadow-md p-8 border border-black hover:outline ml-4 first:ml-0 mb-4 ${source === id ? 'outline' : ''}`} type='button' onClick={() => setSource(id)} title={`Migrate from ${name}`}>
              {logo}
            </button>
          ))}
        </div>
        <button onClick={handleNextClick} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap ${source ? 'hover:bg-white hover:text-hot-red' : 'opacity-10'}`} disabled={!source}>
          Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle' style={{marginTop: -4}} />
        </button>
      </div>
    </div>
  )
}

function AddSourceToken ({ config, onNext, onPrev }: WizardProps) {
  const [token, setToken] = useState<string|undefined>(config.token)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const ds = dataSources.find(({ source }) => source.id === config.source)
  if (!ds) return

  const handleNextClick: MouseEventHandler = async e => {
    e.preventDefault()
    if (!token || checking) return
    setError('')
    setChecking(true)

    try {
      await ds.source.checkToken(token)
    } catch (err: any) {
      console.error(err)
      return setError(`Error using token: ${err.message}`)
    } finally {
      setChecking(false)
    }
    onNext({ ...config, token })
  }
  return (
    <div className='max-w-4xl'>
      <H1>Add data source token</H1>
      <div className='bg-white my-4 p-5 rounded-2xl border border-hot-red font-epilogue'>
        <p className='mb-8'>Add your API token for <strong>{ds.name}</strong>. Note: the key never leaves this device, it is for local use only by the migration tool.</p>
        <H2>API Token</H2>
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
        <button onClick={e => { e.preventDefault(); onPrev() }} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm mr-2 px-6 py-2 rounded-full whitespace-nowrap hover:bg-white hover:text-hot-red`}>
          <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}}/> Previous
        </button>
        <button onClick={handleNextClick} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap ${token ? 'hover:bg-white hover:text-hot-red' : 'opacity-10'}`} disabled={!token || checking}>
          {checking
            ? <><ArrowPathIcon className={`h-5 w-5 animate-spin inline-block mr-1 align-middle`}/>Checking...</>
            : <>Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle' style={{marginTop: -4}}/></>}
        </button>
      </div>
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
    <div className='font-epilogue'>
      <H1>Target space</H1>
      <p className='mb-8'>Choose an existing space to migrate data to.</p>
      <H2>Space</H2>
      <div className='max-w-lg border rounded-2xl border-hot-red bg-white mb-4'>
        {spaces.map(s => (
          <button
            key={s.did()}
            type='button'
            className={`w-full flex flex-row items-start gap-4 p-4 text-left border-b last:border-0 border-hot-red first:rounded-t-2xl last:rounded-b-2xl ${s.did() === space ? 'bg-hot-yellow' : 'hover:bg-hot-yellow-light'}`}
            onClick={() => setSpace(s.did())}>
            <DidIcon did={s.did()} />
            <div className='grow overflow-hidden whitespace-nowrap text-ellipsis'>
              <span className='text-lg text-hot-red leading-5 m-0'>
                {s.name || 'Untitled'}
              </span>
              <span className='font-mono text-xs block'>
                {s.did()}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button onClick={e => { e.preventDefault(); onPrev() }} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm mr-2 px-6 py-2 rounded-full whitespace-nowrap hover:bg-white hover:text-hot-red`}>
        <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}}/> Previous
      </button>
      <button onClick={handleNextClick} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap ${space ? 'hover:bg-white hover:text-hot-red' : 'opacity-10'}`} disabled={!space}>
        Next <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle' style={{marginTop: -4}}/>
      </button>
    </div>
  )
}

function Confirmation ({ config, onNext, onPrev }: WizardProps) {
  const [{ spaces }] = useW3()
  const space = spaces.find(s => s.did() === config.space)
  if (!space) return

  const ds = dataSources.find(({ source }) => source.id === config.source)
  if (!ds) return

  const handleNextClick: MouseEventHandler = async e => {
    e.preventDefault()
    onNext(config)
  }
  return (
    <div className='max-w-4xl'>
      <H1>Ready to start!</H1>
      <div className='bg-white my-4 p-5 rounded-2xl border border-hot-red font-epilogue'>
        <p className='mb-8'>Make sure these details are correct before starting the migration.</p>
        <H2>Source</H2>
        <div className={`bg-white/60 rounded-lg shadow-md p-8 mb-4 inline-block border border-black`} title={ds.name}>
          {ds.logo}
        </div>
        <H2>Target</H2>
        <div className='max-w-lg border rounded-2xl border-hot-red bg-white mb-4'>
          <div className={`flex flex-row items-start gap-4 p-4 text-left border-b last:border-0 border-hot-red first:rounded-t-2xl last:rounded-b-2xl`}>
            <DidIcon did={space.did()} />
            <div className='grow overflow-hidden whitespace-nowrap text-ellipsis'>
              <span className='text-lg text-hot-red leading-5 m-0'>
                {space.name || 'Untitled'}
              </span>
              <span className='font-mono text-xs block'>
                {space.did()}
              </span>
            </div>
          </div>
        </div>

        <button onClick={e => { e.preventDefault(); onPrev() }} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm mr-2 px-6 py-2 rounded-full whitespace-nowrap hover:bg-white hover:text-hot-red`}>
          <ChevronLeftIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}}/> Previous
        </button>
        <button onClick={handleNextClick} className={`inline-block bg-hot-red border border-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap hover:bg-white hover:text-hot-red`}>
          Start <ChevronRightIcon className='h-5 w-5 inline-block ml-1 align-middle' style={{marginTop: -4}}/>
        </button>
      </div>
    </div>
  )
}
