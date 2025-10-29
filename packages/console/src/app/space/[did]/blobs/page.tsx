'use client';
import { use, type JSX } from "react";

import {
  useW3,
  Space,
  Client,
  SpaceBlobListSuccess,
} from '@storacha/ui-react'
import useSWR from 'swr'
import { useRouter, usePathname } from 'next/navigation'
import { createBlobsListKey } from '@/cache'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { logAndCaptureError } from '@/sentry'
import { BlobsList } from '@/components/BlobsList'
import BlobsOrUploads from '@/components/BlobsOrUploads'

const pageSize = 15

interface SearchParams {
  cursor: string
  pre: string
}

interface PageProps {
  params: Promise<{
    did: string
  }>
  searchParams: Promise<SearchParams>
}

export default function Page(props: PageProps): JSX.Element {
  const searchParams = use(props.searchParams);
  const params = use(props.params);
  const [{ client, spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find((s) => s.did() === spaceDID)

  return (
    <>
      {space && (
        <>
          <Breadcrumbs space={space.did()} />
          <BlobsOrUploads space={space.did()} selected="blobs" />
        </>
      )}
      <SpaceBlobsList
        space={space}
        client={client}
        searchParams={searchParams}
      />
    </>
  )
}

function SpaceBlobsList({
  space,
  client,
  searchParams,
}: {
  space?: Space
  client?: Client
  searchParams: SearchParams
}) {
  const key = space
    ? createBlobsListKey(
        space.did(),
        searchParams.cursor,
        searchParams.pre === 'true'
      )
    : ''

  const {
    data: blobs,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<SpaceBlobListSuccess | undefined>(key, {
    fetcher: async () => {
      if (!client || !space) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      return await client.capability.blob.list({
        cursor: searchParams.cursor,
        pre: searchParams.pre === 'true',
        size: pageSize,
      })
    },
    onError: logAndCaptureError,
    keepPreviousData: true,
  })

  const router = useRouter()
  const pathname = usePathname()

  if (!space) return <div />

  const handleNext =
    blobs?.after && blobs.results.length === pageSize
      ? () => router.push(`${pathname}?cursor=${blobs.after}`)
      : undefined
  const handlePrev =
    searchParams.cursor && blobs?.before
      ? () => router.push(`${pathname}?cursor=${blobs.before ?? ''}&pre=true`)
      : undefined
  const handleRefresh = () => mutate()
  return (
    <BlobsList
      space={space}
      blobs={blobs?.results ?? []}
      loading={isLoading}
      validating={isValidating}
      onNext={handleNext}
      onPrev={handlePrev}
      onRefresh={handleRefresh}
    />
  )
}
