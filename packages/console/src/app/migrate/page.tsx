'use client'

import { useW3 } from '@storacha/ui-react'
import SidebarLayout from '@/components/SidebarLayout'
import { SpacesNav } from '@/app/space/layout'
import { H1, H2 } from '@/components/Text'
import { MigrationWizard } from '@/components/migration/MigrationWizard'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function MigrateAllPage() {
  return (
    <SidebarLayout>
      <MigrateAllContent />
    </SidebarLayout>
  )
}

function MigrateAllContent() {
  const [{ spaces }] = useW3()

  if (spaces.length === 0) {
    return (
      <>
        <SpacesNav />
        <H1>Migrate to Filecoin</H1>
        <div className="text-center py-8 text-gray-500">
          <p>No spaces to migrate.</p>
          <Link href="/" className="text-hot-red hover:underline">
            Go back to spaces
          </Link>
        </div>
      </>
    )
  }

  const spaceDIDs = spaces.map(s => s.did() as `did:key:${string}`)

  return (
    <>
      <SpacesNav />
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-hot-red"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Spaces
        </Link>
      </div>
      <H1>Migrate All Spaces</H1>
      <p className="text-gray-600 mb-6">
        Migrate all {spaces.length} space{spaces.length > 1 ? 's' : ''} to Filecoin storage.
      </p>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <H2 className="text-blue-800 mb-2">Spaces to migrate</H2>
        <ul className="text-sm text-blue-700 space-y-1">
          {spaces.map(space => (
            <li key={space.did()} className="flex items-center gap-2">
              <span className="font-medium">{space.name || 'Untitled'}</span>
              <code className="text-xs bg-blue-100 px-1 rounded">{space.did().slice(0, 20)}...</code>
            </li>
          ))}
        </ul>
      </div>

      <MigrationWizard 
        spaceDIDs={spaceDIDs} 
        roundaboutURL={process.env.NEXT_PUBLIC_ROUNDABOUT_URL}
      />
    </>
  )
}
