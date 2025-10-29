'use client';
import { use, type JSX } from "react";

import { useW3 } from '@storacha/ui-react'
import { parse as parseLink } from 'multiformats/link'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ShardDetail } from '@/components/ShardDetail'

interface PageProps {
  params: Promise<{
    did: string
    cid: string
    shard: string
  }>
}

export default function ItemPage(props: PageProps): JSX.Element {
  const params = use(props.params);
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
