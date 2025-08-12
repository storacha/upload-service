'use client'

import { useW3 } from '@storacha/ui-react'
import { parse as parseLink } from 'multiformats/link'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ShardDetail } from '@/components/ShardDetail'

interface PageProps {
  params: {
    did: string
    cid: string
    shard: string
  }
}

export default function ItemPage ({ params }: PageProps): JSX.Element {
  const [{ client, spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)
  const root = parseLink(params.cid)
  const shard = parseLink(params.shard).toV1()

  if (!space) {
    return <h1>Space not found</h1>
  }
  return (
    <div>
      <Breadcrumbs space={space.did()} root={root} shard={shard} />
      <ShardDetail client={client} space={space} shard={shard}/>
    </div>
  )
}
