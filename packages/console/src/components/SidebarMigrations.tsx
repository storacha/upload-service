import { useRouter } from 'next/navigation'
import { useMigrations } from './MigrationsProvider'
import { H2 } from './Text'
import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { DidIcon } from './DidIcon'
import { Migration } from '@/lib/migrations/api'

export const SidebarMigrations = () => {
  const [{ migrations }] = useMigrations()
  const router = useRouter()
  return (
    <>
      <button type='button' className='float-right' onClick={e => { e.preventDefault(); router.push('/migration/create') }}>
        <PlusCircleIcon className='w-9 px-2 hover:text-white' style={{ marginTop: -2 }} title='Start a new migration' />
      </button>
      <H2 className='text-hot-red font-bold'>Migrations</H2>
      <MigrationsList migrations={migrations} />
    </>
  )
}

const MigrationsList = ({ migrations }: { migrations: Migration[] }) => {
  const router = useRouter()
  if (!migrations.length) {
    return <p className='text-xs text-hot-red'>No running migrations</p>
  }
  const selected = window.location.pathname.split('/').pop()
  return migrations.map(m => {
    return (
      <button key={m.id} className={`text-sm p-2 rounded bg-white/20 ${selected === m.id ? 'outline' : ''} hover:outline align-middle w-full text-left mb-2`} onClick={() => router.push(`/migration/${m.id}`)}>
        {m.source === 'classic.nft.storage' ? 'NFT' : 'w3s'}
        <span className='mx-2'>→</span>
        <DidIcon did={m.space} width={5} display='inline-block' />
      </button>
    )
  })
}
