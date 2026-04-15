'use client'

import { use, type JSX } from 'react'
import { useW3 } from '@storacha/ui-react'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { PrivateSpaceGuard } from '@/components/PrivateSpaceGuard'
import { MigrationWizard } from '@/components/migration/MigrationWizard'

interface PageProps {
  params: Promise<{
    did: string
  }>
}

export default function MigratePage(props: PageProps): JSX.Element {
  const params = use(props.params)
  const [{ spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)

  if (!space) return <div />

  return (
    <PrivateSpaceGuard spaceDID={spaceDID}>
      <Breadcrumbs space={space.did()} />
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Migrate to Filecoin Pin
        </h2>
        <p className="text-gray-600 mb-6">
          Migrate your content to Filecoin on Chain (FOC) for permanent decentralized storage.
          Storage providers will pull your data directly from Storacha — no re-upload needed.
        </p>
        <MigrationWizard 
          spaceDID={spaceDID} 
          roundaboutURL={process.env.NEXT_PUBLIC_ROUNDABOUT_URL}
        />
      </div>
    </PrivateSpaceGuard>
  )
}
