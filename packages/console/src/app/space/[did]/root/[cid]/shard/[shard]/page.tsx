'use client'

import { H2 } from '@/components/Text'
import { useW3, FilecoinInfoSuccess, StoreGetSuccess } from '@w3ui/react'
import useSWR from 'swr'
import { parse as parseLink } from 'multiformats/link'
import DefaultLoader from '@/components/Loader'
import * as Claims from '@web3-storage/content-claims/client'
import { Piece, PieceLink } from '@web3-storage/data-segment'
import CopyIcon from '@/components/CopyIcon'
import { EqualsClaim } from '@web3-storage/content-claims/client/api'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { filesize } from '@/lib'

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
  const shard = parseLink(params.shard)

  const storeKey = `/space/${spaceDID}/store/get?link=${shard}`
  const store = useSWR<StoreGetSuccess|undefined>(storeKey, {
    fetcher: async () => {
      if (!client || !space) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      return await client.capability.store.get(shard)
    },
    onError: err => console.error(err.message, err.cause)
  })

  const claimKey = `/assert/equals?content=${shard}`
  const claim = useSWR<EqualsClaim|undefined>(claimKey, {
    fetcher: async () => {
      const claims = await Claims.read(shard)
      for (const claim of claims) {
        if (claim.type === 'assert/equals' && isPieceLink(claim.equals)) {
          return claim
        }
      }
    },
    onError: err => console.error(err.message, err.cause)
  })

  const filecoinInfoKey = `/filecoin/info?piece=${claim.data?.equals}`
  const filecoinInfo = useSWR<FilecoinInfoSuccess|undefined>(filecoinInfoKey, {
    fetcher: async () => {
      if (!client || !space || !claim.data) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      const { out } = await client.capability.filecoin.info(claim.data.equals as PieceLink)
      if (out.error) {
        throw new Error('failed to get filecoin info', { cause: out.error })
      }
      return out.ok
    },
    onError: err => console.error(err.message, err.cause)
  })

  if (!space) {
    return <h1>Space not found</h1>
  }
  return (
    <div>
      <Breadcrumbs space={space.did()} root={root} shard={shard} />
      <H2>Shard CID</H2>
      <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
        {shard.toString()}
        <CopyIcon text={shard.toString()} />
      </div>
      <H2>Piece CID</H2>
      <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
        {claim.isLoading
          ? <DefaultLoader className='w-5 h-5 inline-block' />
          : claim.data
            ? <>{claim.data.equals.toString()}<CopyIcon text={String(claim.data.equals)} /></>
            : 'Unknown'}
      </div>
      <H2>Size</H2>
      <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
        {store.isLoading
          ? <DefaultLoader className='w-5 h-5 inline-block' />
          : store.data
            ? filesize(store.data.size)
            : 'Unknown'}
      </div>
      <H2>Aggregate CID</H2>
      <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
        {claim.isLoading || filecoinInfo.isLoading
          ? <DefaultLoader className='w-5 h-5 inline-block' />
          : filecoinInfo.data?.aggregates.length
            ? filecoinInfo.data?.aggregates.map(({ aggregate }) => {
                return (
                  <div key={aggregate.toString()}>
                    {aggregate.toString()}<CopyIcon text={aggregate.toString()} />
                    <br/>
                    <span className='font-sans opacity-60'>aka </span>
                    {Piece.fromLink(aggregate).toInfo().link.toString()}<CopyIcon text={aggregate.toString()} />
                  </div>
                )
              })
            : 'Unknown'}
      </div>
      <H2>Storage Providers</H2>
      <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
        {claim.isLoading || filecoinInfo.isLoading
            ? <DefaultLoader className='w-5 h-5 inline-block' />
            : filecoinInfo.data && filecoinInfo.data.deals.length
              ? (
                  <ol className='list-decimal list-inside'>
                    {filecoinInfo.data.deals.map(d => (
                      <li key={d.aux.dataSource.dealID}>
                        <a href={`https://filfox.info/address/f0${d.provider}`} target='_blank' className='underline'>f0{d.provider}</a>
                        <span className='text-xs tracking-wider font-bold px-2 text-black font-mono inline-block'>@</span>
                        <a href={`https://filfox.info/deal/${d.aux.dataSource.dealID}`} target='_blank' className='underline'>{d.aux.dataSource.dealID.toString()}</a>
                      </li>
                    ))}
                  </ol>
                )
              : 'None'}
      </div>
    </div>
  )
}

function isPieceLink(link: any): link is PieceLink {
  try {
    Piece.fromLink(link)
    return true
  } catch {
    return false
  }
}
