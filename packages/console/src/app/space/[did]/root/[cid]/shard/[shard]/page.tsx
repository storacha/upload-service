'use client'

import { CAR } from '@ucanto/transport'
import { H2 } from '@/components/Text'
import { useW3, FilecoinInfoSuccess, BlobGetSuccess, CARLink } from '@w3ui/react'
import useSWR from 'swr'
import { Link, parse as parseLink } from 'multiformats/link'
import DefaultLoader from '@/components/Loader'
import * as Claims from '@web3-storage/content-claims/client'
import { Aggregate, MerkleTreeNode, Piece, PieceLink, PieceView, Proof, ProofData } from '@web3-storage/data-segment'
import CopyIcon from '@/components/CopyIcon'
import { EqualsClaim } from '@web3-storage/content-claims/client/api'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { filesize } from '@/lib'
import archy from 'archy'
import QuestionIcon from '@/components/QuestionIcon'
import ExpandIcon from '@/components/ExpandIcon'
import { useState } from 'react'
import AggregateIcon from '@/components/AggregateIcon'
import PieceIcon from '@/components/PieceIcon'

type ProofStyle = 'mini'|'midi'|'maxi'

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

  const storeKey = `/space/${spaceDID}/store/get?link=${shard}`
  const store = useSWR<{ size: number } | undefined>(storeKey, {
    fetcher: async () => {
      if (!client || !space || !isCARLink(shard)) return

      if (client.currentSpace()?.did() !== space.did()) {
        await client.setCurrentSpace(space.did())
      }

      // First try to get the shard using the Blob protocol, then fall back to
      // the Store protocol.
      try {
        const result = await client.capability.blob.get(shard.multihash)
        // Note that, oddly, this result is never `error`, but the call may
        // throw.
        return result.ok.blob
      } catch (blobErr) {
        // Rethrow other errors.
        if (!isErrorCausedByBlobNotFound(blobErr)) throw blobErr

        // If there was no Blob, try the Store protocol.
        try {
          return await client.capability.store.get(shard)
        } catch (storeErr) {
          throw new Error(
            'failed to get shard with either Blob or Store protocols',
            { cause: [blobErr, storeErr] }
          )
        }
      }
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

  const [proofStyle, setProofStyle] = useState<ProofStyle>('mini')

  if (!space) {
    return <h1>Space not found</h1>
  }
  return (
    <div>
      <Breadcrumbs space={space.did()} root={root} shard={shard} />
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
        <H2>Shard CID</H2>
        <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
          {shard.toString()}
          <CopyIcon text={shard.toString()} />
        </div>
        <H2>Piece CID<PieceIcon /></H2>
        <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
          {claim.isLoading
            ? <DefaultLoader className='w-6 h-6 inline-block' />
            : claim.data
              ? <><span className='border-hot-red border-b-2 border-dotted'>{claim.data.equals.toString()}</span><CopyIcon text={String(claim.data.equals)} /></>
              : 'Unknown'}
        </div>
        <H2>Size</H2>
        <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
          {store.isLoading
            ? <DefaultLoader className='w-6 h-6 inline-block' />
            : store.data
              ? filesize(store.data.size)
              : 'Unknown'}
        </div>
        <H2>Aggregate CID<AggregateIcon /></H2>
        <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
          {claim.isLoading || filecoinInfo.isLoading
            ? <DefaultLoader className='w-6 h-6 inline-block' />
            : filecoinInfo.data && filecoinInfo.data.aggregates.length
              ? filecoinInfo.data.aggregates.map(({ aggregate, inclusion }) => {
                  const piece = filecoinInfo.data?.piece
                  if (!piece) return <div key={Math.random()}/>
                  const pieceInfo = Piece.fromLink(aggregate).toInfo()
                  return (
                    <div key={aggregate.toString()}>
                      <span className='opacity-60'>v1: </span>
                      {pieceInfo.link.toString()}<CopyIcon text={aggregate.toString()} />
                      <div className='pl-10'>
                        └── Height: {pieceInfo.height}
                        <QuestionIcon title='Height is encoded in v2 piece CID' />
                      </div>
                      <span className='opacity-60'>v2: </span>
                      <span className='border-hot-yellow border-b-2 border-dotted'>{aggregate.toString()}</span>
                      <CopyIcon text={aggregate.toString()} />
                      <H2 className='mt-5'>
                        Inclusion Proof
                        <ExpandIcon open={proofStyle === 'maxi'} onToggle={() => setProofStyle(proofStyle === 'mini' ? 'midi' : proofStyle === 'midi' ? 'maxi' : 'mini')} />
                      </H2>
                      <InclusionProof proof={inclusion.subtree} piece={Piece.fromLink(piece)} style={proofStyle} />
                    </div>
                  )
                })
              : 'Unknown'}
        </div>
        {claim.isLoading || filecoinInfo.isLoading
            ? <>
                <H2>Inclusion Proof</H2>
                <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
                  <DefaultLoader className='w-6 h-6 inline-block' />
                </div>
              </>
            : null}
        <H2>Storage Providers</H2>
        <div className='pb-5 font-mono text-sm overflow-hidden no-wrap text-ellipsis'>
          {claim.isLoading || filecoinInfo.isLoading
              ? <DefaultLoader className='w-6 h-6 inline-block' />
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
    </div>
  )
}

function isCARLink(link: Link): link is CARLink {
  return link.code === CAR.codec.code
}

/**
 * True if the error is caused by a BlobNotFound error. (This is a slightly
 * convoluted signal at the moment; the client could be clearer about signaling
 * this, but this is what it currently throws.)
 * @param exception The thrown value
 */
function isErrorCausedByBlobNotFound(exception: unknown) {
  return (
    exception &&
    typeof exception === 'object' &&
    'cause' in exception &&
    exception.cause &&
    typeof exception.cause === 'object' &&
    'name' in exception.cause &&
    exception.cause.name === 'BlobNotFound'
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

const MAX_DEPTH = 63

// Adapted from https://github.com/web3-storage/data-segment/blob/e9cdcbf76232e5b92ae1d13f6cf973ec9ab657ef/src/proof.js#L62-L86
function InclusionProof ({ proof, piece, style }: { proof: ProofData, piece: PieceView, style: ProofStyle }): JSX.Element {
  if (Proof.depth(proof) > MAX_DEPTH) {
    throw new RangeError('merkle proofs with depths greater than 63 are not supported')
  }

  let position = BigInt(Proof.offset(proof))
  if (position >> BigInt(Proof.depth(proof)) !== 0n) {
    throw new RangeError('offset greater than width of the tree')
  }

  const { root } = piece
  let nodes: archy.Data['nodes'] = []
  let top = root
  let right = 0n
  let height = piece.height

  for (const node of Proof.path(proof)) {
    right =  position & 1n
    position = position >> 1n

    const label = top === root
      ? Piece.toLink(piece).toString()
      : Piece.toLink({ root: top, height: height + 1, padding: 0n }).toString()
    const otherLabel = Piece.toLink({ root: node, height, padding: 0n }).toString()

    if (style === 'midi' || style === 'maxi') {
      if (right === 1n) {
        nodes = [{
          label: otherLabel,
          nodes: style === 'maxi' ? ['...', '...'] : []
        }, {
          label: `*${label}`,
          nodes
        }]
      } else {
        nodes = [{
          label: `*${label}`,
          nodes
        }, {
          label: otherLabel,
          nodes: style === 'maxi' ? ['...', '...'] : []
        }]
      }
    } else {
      nodes = [{ label: `*${label}`, nodes }]
    }
    top = right === 1n ? Proof.computeNode(node, top) : Proof.computeNode(top, node)
    height++
  }

  const aggregate = Aggregate.toLink({ root: top, height })
  const data = { label: aggregate.toString(), nodes }

  return (
    <div className='font-mono whitespace-nowrap overflow-x-scroll'>
      {archy(data).split('\n').map(line => {
        if (!line) return <div />
        if (line.indexOf(' ') === -1) {
          return (
            <div key={line}>
              <span className='border-purple-500 border-b-2 border-dotted'>{line}</span>
              <AggregateIcon className='opacity-60' />
              <span className='text-sm opacity-60'>Aggregate CID</span>
            </div>
          )
        }
        const index = line.lastIndexOf(' ')
        const tree = line.slice(0, index)
        let label = line.slice(index + 1)
        let isPath = false
        if (label.startsWith('*')) {
          isPath = true
          label = label.slice(1)
        }
        const isPiece = label === Piece.toLink(piece).toString()

        return (
          <div key={line}>
            <pre className='inline-block'>{tree}</pre>&nbsp;
            <span className={`${isPath ? 'opacity-100' : 'opacity-30'} ${isPiece ? 'border-blue-600 border-b-2 border-dotted' : ''}`}>
              {label}
            </span>
            {isPiece && <><PieceIcon className='opacity-60' /><span className='text-sm opacity-60'>Piece CID</span></>}
          </div>
        )
      })}
    </div>
  )
}
