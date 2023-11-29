import Link from 'next/link'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { DID, SpaceDID, UnknownLink } from '@w3ui/react'
import { shortenCID, shortenDID } from '@/lib'

export function Breadcrumbs ({ space, root, shard }: { space: SpaceDID, root?: UnknownLink, shard?: UnknownLink }) {
  const crumbs = []
  crumbs.push(
    <Link key={space} title={`Space: ${space}`} href={`/space/${space}`} className='underline font-mono text-sm'>{shortenDID(space)}</Link>,
    <ChevronRightIcon key='>0' className='w-8 inline-block align-middle mb-1 px-2 py-0' />
  )
  if (root && shard) {
    crumbs.push(
      <Link key={root.toString()} title={`Upload: ${root}`} href={`/space/${space}/root/${root}`} className='underline font-mono text-sm'>{shortenCID(root)}</Link>,
      <ChevronRightIcon key='>1' className='w-8 inline-block align-middle mb-1 px-2 py-0' />
    )
  } else if (root) {
    crumbs.push(<span key={root.toString()} title={`Upload: ${root}`} className='font-mono text-sm'>{shortenCID(root)}</span>)
  }
  if (shard) {
    crumbs.push(<span key={shard.toString()} title={`Shard: ${root}`} className='font-mono text-sm'>{shortenCID(shard)}</span>)
  }

  return <div className='mb-6 bg-opacity-30 bg-white py-2 px-2 rounded break-words max-w-4xl shadow-inner'>{crumbs}</div>
}
