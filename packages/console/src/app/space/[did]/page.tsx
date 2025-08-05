'use client'

import { UploadsList } from '@/components/UploadsList'
import { useW3, UnknownLink, UploadListSuccess } from '@storacha/ui-react'
import useSWR from 'swr'
import { useRouter, usePathname } from 'next/navigation'
import { PrivateSpaceGuard } from '@/components/PrivateSpaceGuard'
import { createUploadsListKey } from '@/cache'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { logAndCaptureError } from '@/sentry'

const pageSize = 15

interface PageProps {
  params: {
    did: string
  },
  searchParams: {
    cursor: string
    pre: string
  }
}

export default function Page ({ params, searchParams }: PageProps): JSX.Element {
  const [{ client, spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)

  const key = space ? createUploadsListKey(space.did(), searchParams.cursor, searchParams.pre === 'true') : ''
  const { data: uploads, isLoading, isValidating, mutate } = useSWR<UploadListSuccess|undefined>(key, {
    fetcher: async () => {
      if (!client || !space) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      return await client.capability.upload.list({
        cursor: searchParams.cursor,
        pre: searchParams.pre === 'true',
        size: pageSize
      })
    },
    onError: logAndCaptureError,
    keepPreviousData: true
  })

  const pathname = usePathname()

  if (!space) return <div />
  
  // If space is private and user doesn't have access, the PrivateSpaceGuard will handle redirection
  return (
    <PrivateSpaceGuard spaceDID={spaceDID}>
      <SpaceContent 
        space={space} 
        uploads={uploads} 
        isLoading={isLoading} 
        isValidating={isValidating}
        onRefresh={mutate}
        pathname={pathname}
        searchParams={searchParams}
      />
    </PrivateSpaceGuard>
  )
}

interface SpaceContentProps {
  space: any // Replace with your Space type
  uploads: UploadListSuccess | undefined
  isLoading: boolean
  isValidating: boolean
  onRefresh: () => void
  pathname: string
  searchParams: { cursor?: string; pre?: string }
}

function SpaceContent({ 
  space, 
  uploads, 
  isLoading, 
  isValidating, 
  onRefresh, 
  pathname, 
  searchParams 
}: SpaceContentProps) {
  const router = useRouter()
  
  const handleSelect = (root: UnknownLink) => router.push(`${pathname}/root/${root}`)
  const handleNext = uploads?.after && (uploads.results.length === pageSize)
    ? () => router.push(`${pathname}?cursor=${uploads.after}`)
    : undefined
  const handlePrev = searchParams.cursor && uploads?.before
    ? () => router.push(`${pathname}?cursor=${uploads.before ?? ''}&pre=true`)
    : undefined

  return (
    <>
      <Breadcrumbs space={space.did()} />
      <UploadsList
        space={space}
        uploads={uploads?.results ?? []}
        loading={isLoading}
        validating={isValidating}
        onSelect={handleSelect}
        onNext={handleNext}
        onPrev={handlePrev}
        onRefresh={onRefresh}
      />
    </>
  )
}
