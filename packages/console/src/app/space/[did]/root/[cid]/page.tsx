'use client'

import { H2 } from '@/components/Text'
import { useW3, UploadGetSuccess, FilecoinInfoSuccess, SpaceDID, CARLink } from '@w3ui/react'
import useSWR from 'swr'
import { UnknownLink, parse as parseLink } from 'multiformats/link'
import DefaultLoader from '@/components/Loader'
import * as Claims from '@web3-storage/content-claims/client'
import { Piece, PieceLink } from '@web3-storage/data-segment'
import Link from 'next/link'
import CopyIcon from '@/components/CopyIcon'
import BackIcon from '@/components/BackIcon'
import { Breadcrumbs } from '@/components/Breadcrumbs'

interface PageProps {
  params: {
    did: string
    cid: string
  }
}

export default function ItemPage ({ params }: PageProps): JSX.Element {
  const [{ client, spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)
  const root = parseLink(params.cid)

  const uploadKey = `/space/${spaceDID}/upload/${root}`
  const upload = useSWR<UploadGetSuccess|undefined>(uploadKey, {
    fetcher: async () => {
      if (!client || !space) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      return await client.capability.upload.get(root)
    },
    onError: err => console.error(err.message, err.cause)
  })

  if (!space) {
    return <h1>Space not found</h1>
  }
  const url = `https://${root}.ipfs.w3s.link`
  return (
    <div>
      <Breadcrumbs space={space.did()} root={root} />
      <H2>Root CID</H2>
      <div className="pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis">
        {root.toString()}
        <CopyIcon text={root.toString()} />
      </div>
      <H2>URL</H2>
      <div className="pb-5 overflow-hidden no-wrap text-ellipsis">
        <a href={url} className="font-mono text-sm underline m-0 p-0">{url}</a>
        <CopyIcon text={url} />
      </div>
      <H2>Shards</H2>
      <div className='pb-5'>
        {upload.isLoading
          ? <DefaultLoader className='w-5 h-5 inline-block' />
          : upload.data?.shards?.map(link => <Shard space={space.did()} root={root} shard={link} key={link.toString()} />)}
      </div>
    </div>
  )
}

function Shard ({ space, root, shard }: { space: SpaceDID, root: UnknownLink, shard: CARLink }) {
  return (
    <div>
      <Link href={`/space/${space}/root/${root}/shard/${shard}`} className='font-mono text-sm overflow-hidden no-wrap text-ellipsis underline'>{shard.toString()}</Link>
      <CopyIcon text={shard.toString()} />
    </div>
  )
}
