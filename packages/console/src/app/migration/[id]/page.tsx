'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@headlessui/react'
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { H1, H2 } from '@/components/Text'
import { useMigrations } from '@/components/MigrationsProvider'
import { DidIcon } from '@/components/DidIcon'
import { CheckCircleIcon, ClockIcon, FlagIcon } from '@heroicons/react/20/solid'
import { Migration, MigrationProgress } from '@/lib/migrations/api'
import { useRouter } from 'next/navigation'

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
  const [isRemoveConfirmModalOpen, setRemoveConfirmModalOpen] = useState(false)
  const router = useRouter()
  const migration = migrations.find(m => m.id === params.id)
  if (!migration) return <H1>Migration not found</H1>

  const handleRemove = () => {
    removeMigration(migration.id)
    router.replace('/')
  }

  return (
    <div>
      <H1>Migrating from {migration.source}</H1>
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
      <button onClick={e => { e.preventDefault(); setRemoveConfirmModalOpen(true) }} className={`inline-block bg-zinc-950 text-white font-bold text-sm pl-4 pr-6 py-2 rounded-full whitespace-nowrap hover:bg-red-700 hover:outline`}>
        <TrashIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> Remove
      </button>
      <RemoveConfirmModal
        isOpen={isRemoveConfirmModalOpen}
        onConfirm={handleRemove}
        onCancel={() => setRemoveConfirmModalOpen(false)}
      />
    </div>
  )
}

const MigrationStatus = ({ migration }: { migration: Migration }) => {
  let Icon = ClockIcon
  let text = 'Running'
  if (!migration.progress) {
    Icon = FlagIcon
    text = 'Starting'
  } else if (!migration.progress.pending) {
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
    <pre className='text-xs p-4 h-96 bg-white/60 overflow-y-auto mb-4'>
      {lines.map(line => `${line}\n`)}
      {lines.length ? '' : 'No logs yet!'}
      <div ref={ref} className='py-2'></div>
    </pre>
  )
}

const ProgressBar = ({ progress }: { progress?: MigrationProgress }) => {
  const attempted = progress ? progress.succeeded + progress.failed.length : 0
  const total = progress ? attempted + progress.pending : 0
  const percentage = progress ? Math.round((attempted / total) * 100) : 0
  return (
    <div className='mb-4'>
      <style scoped>{progressStyles}</style>
      <progress max='100' value={percentage} className='w-full shadow rounded-xl my-2 block'></progress>
      <div className='flex justify-between'>
        <div className='font-mono text-xs'>{progress?.current?.toString() ?? 'No current item'}</div>
        <div className='text-xs'>{attempted.toLocaleString()} of {total ? total.toLocaleString() : '?'}</div>
      </div>
    </div>
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
        <Dialog.Panel className='bg-grad p-4 shadow-lg rounded-lg'>
          <Dialog.Title className='text-lg font-semibold leading-5 text-black text-center my-3'>
            <ExclamationTriangleIcon className='h-10 w-10 inline-block' /><br/>
            Confirm remove
          </Dialog.Title>
          <Dialog.Description className='py-2'>
            Are you sure you want to remove this migration?
          </Dialog.Description>

          <p className='py-2'>You will have to restart this migration if it has not completed.</p>

          <div className='py-2 text-center'>
            <button onClick={e => { e.preventDefault(); setConfirmed(true); onConfirm() }} className={`inline-block bg-red-700 text-white font-bold text-sm pl-4 pr-6 py-2 mr-3 rounded-full whitespace-nowrap ${confirmed ? 'opacity-50' : 'hover:outline'}`} disabled={confirmed}>
              <TrashIcon className='h-5 w-5 inline-block mr-1 align-middle' style={{marginTop: -4}} /> {confirmed ? 'Removing...' : 'Remove'}
            </button>
            <button onClick={e => { e.preventDefault(); setConfirmed(false); onCancel() }} className={`inline-block bg-zinc-950 text-white font-bold text-sm px-8 py-2 rounded-full whitespace-nowrap ${confirmed ? 'opacity-50' : 'hover:outline'}`} disabled={confirmed}>
              Cancel
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
