'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@headlessui/react'
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { H1, H2 } from '@/components/Text'
import { useMigrations } from '@/components/MigrationsProvider'
import { DidIcon } from '@/components/DidIcon'
import CopyIcon from '@/components/CopyIcon'
import { CheckCircleIcon, ClockIcon, FlagIcon } from '@heroicons/react/20/solid'
import { Migration, MigrationProgress } from '@/lib/migrations/api'
import { useRouter } from 'next/navigation'
import { UnknownLink } from '@w3ui/react'

interface PageProps {
  params: {
    id: string
  }
}

const progressStyles = `
progress {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  border: none;
  height: 15px;
  border-radius: 20px;
  background-color: #fff;
  color: #2563eb;
}
progress::-webkit-progress-bar {
  background-color: #fff;
  border-radius: 20px;
}
progress::-webkit-progress-value {
  background-color: #2563eb;
  border-radius: 20px;
}
progress::-moz-progress-bar {
  background-color: #2563eb;
  border-radius: 20px;
}
`

export default function MigrationPage ({ params }: PageProps): JSX.Element {
  const [{ migrations, logs }, { removeMigration }] = useMigrations()
  const router = useRouter()
  const migration = migrations.find(m => m.id === params.id)
  if (!migration) return <H1>Migration not found</H1>

  const handleRemove = () => {
    removeMigration(migration.id)
    router.replace('/')
  }

  return (
    <div className='max-w-6xl'>
      <H1>Migrating from {migration.source}</H1>
      <div className='bg-white my-4 p-4 rounded-2xl border border-hot-red'>
        <div className='flex mb-4'>
          <div className='flex-auto'>
            <H2>Target</H2>
            <p className='font-mono text-xs'>
              <DidIcon did={migration.space} width={5} display='inline-block' /> {migration.space}
            </p>
          </div>
          <div className='flex-auto'>
            <H2>Status</H2>
            <MigrationStatus migration={migration} />
          </div>
        </div>
        <H2>Progress</H2>
        <ProgressBar progress={migration.progress} />
        <H2>Log</H2>
        <LogLines lines={logs[migration.id] ?? []} />
        {
          migration.progress?.failed.length
            ? (
              <>
                <H2>⚠️ {migration.progress.failed.length} Failures</H2>
                <p className='text-sm mb-3'>The following uploads must be migrated manually:</p>
                <FailList items={migration.progress.failed} />
              </>
            )
            : null
        }
      </div>
      <RemoveButton onRemove={handleRemove} progress={migration.progress} />
    </div>
  )
}

const MigrationStatus = ({ migration }: { migration: Migration }) => {
  let Icon = ClockIcon
  let text = 'Running'
  if (!migration.progress) {
    Icon = FlagIcon
    text = 'Starting'
  } else if (migration.progress.pending <= 0) {
    Icon = CheckCircleIcon
    text = 'Complete'
  }
  return (
    <p className='text-xs'>
      <Icon className='h-5 w-5 inline-block align-middle'/> {text}
    </p>
  )
}

const LogLines = ({ lines }: { lines: string[] }) => {
  const ref = useRef<null | HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  })
  return (
    <pre className='text-xs p-4 h-60 bg-white overflow-y-auto mb-4 rounded shadow-inner border'>
      {lines.map(line => `${line}\n`)}
      {lines.length ? '' : 'No logs yet!'}
      <div ref={ref} className='py-2'></div>
    </pre>
  )
}

const ProgressBar = ({ progress }: { progress?: MigrationProgress }) => {
  const attempted = progress ? progress.succeeded + progress.failed.length : 0
  const failed = progress?.failed.length
  const total = progress ? attempted + progress.pending : 0
  const percentage = progress ? Math.round((attempted / total) * 100) : 0
  return (
    <div className='mb-4'>
      <style scoped>{progressStyles}</style>
      <progress max='100' value={percentage} className='w-full shadow rounded-xl my-2 block'></progress>
      <div className='flex justify-between'>
        <div className='font-mono text-xs'>{progress?.current?.toString() ?? 'No current item'}</div>
        <div className='text-xs'>
          {attempted.toLocaleString()} of {total ? total.toLocaleString() : '?'}
          {failed ? <span className='text-red-700 font-bold ml-2'>{failed.toLocaleString()} failures</span> : ''}
        </div>
      </div>
    </div>
  )
}

const RemoveButton = ({ onRemove, progress }: { onRemove: () => void, progress?: MigrationProgress }) => {
  const [isRemoveConfirmModalOpen, setRemoveConfirmModalOpen] = useState(false)

  if (progress && progress.pending <= 0) {
    return (
      <button type='button' onClick={onRemove} className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'>
        <CheckCircleIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Close and Remove
      </button>
    )
  }

  return (
    <>
      <button type='button' onClick={() => setRemoveConfirmModalOpen(true)} className='inline-block bg-hot-red border border-hot-red hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 rounded-full whitespace-nowrap'>
        <TrashIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Remove
      </button>
      <RemoveConfirmModal
        isOpen={isRemoveConfirmModalOpen}
        onConfirm={onRemove}
        onCancel={() => setRemoveConfirmModalOpen(false)}
      />
    </>
  )
}

interface RemoveConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

function RemoveConfirmModal ({ isOpen, onConfirm, onCancel }: RemoveConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <Dialog open={isOpen} onClose={() => { setConfirmed(false); onCancel() }} className='relative z-50'>
      <div className='fixed inset-0 flex w-screen items-center justify-center bg-black/70' aria-hidden='true'>
        <Dialog.Panel className='bg-hot-red p-10 shadow-lg rounded-lg font-epilogue text-white'>
          <Dialog.Title className='text-lg text-center my-3'>
            <ExclamationTriangleIcon className='h-10 w-10 inline-block' /><br/>
            Confirm remove
          </Dialog.Title>
          <Dialog.Description className='py-2'>
            Are you sure you want to remove this migration?
          </Dialog.Description>
          <p className='py-2'>The migration has not yet completed.</p>
          <div className='py-2 text-center'>
            <button onClick={e => { e.preventDefault(); setConfirmed(true); onConfirm() }} className={`inline-block bg-hot-red-light border border-white hover:bg-white hover:text-hot-red font-epilogue text-hot-red uppercase text-sm px-6 py-2 mr-3 rounded-full whitespace-nowrap ${confirmed ? 'opacity-50' : 'hover:outline'}`} disabled={confirmed}>
              <TrashIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> {confirmed ? 'Removing...' : 'Remove'}
            </button>
            <button onClick={e => { e.preventDefault(); setConfirmed(false); onCancel() }} className={`inline-block bg-hot-red border border-white hover:bg-white hover:text-hot-red font-epilogue text-white uppercase text-sm px-6 py-2 mr-3 rounded-full whitespace-nowrap ${confirmed ? 'opacity-50' : 'hover:outline'}`} disabled={confirmed}>
              Cancel
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

const FailList = ({ items }: { items: UnknownLink[] }) => {
  const content = items.join('\n')
  return (
    <div className='max-w-lg'>
      <div className='float-right'><CopyIcon text={content} /></div>
      <pre className='text-xs p-4 max-h-24 bg-white overflow-y-auto rounded shadow-inner border'>
        {content}
      </pre>
    </div>
  )
}
