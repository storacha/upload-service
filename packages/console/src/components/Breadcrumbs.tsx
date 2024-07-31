import Link from 'next/link'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { SpaceDID, UnknownLink } from '@w3ui/react'
import { shortenCID, shortenDID } from '@/lib'

export function Breadcrumbs ({ space, root, shard }: { space: SpaceDID, root?: UnknownLink, shard?: UnknownLink }) {
  const crumbs = []
  crumbs.push(
    <Link key='spaces' title='Spaces' href='/' className='underline font-mono text-sm'>Spaces</Link>,
    <ChevronRightIcon key='>0' className='w-8 inline-block align-middle mb-1 px-2 py-0' />
  )
  if (root) {
    crumbs.push(
      <Link key={space} title={`Space: ${space}`} href={`/space/${space}`} className='underline font-mono text-sm'>{shortenDID(space)}</Link>,
      <ChevronRightIcon key='>1' className='w-8 inline-block align-middle mb-1 px-2 py-0' />
    )
    if (shard) {
      crumbs.push(
        <Link key={root.toString()} title={`Upload: ${root}`} href={`/space/${space}/root/${root}`} className='underline font-mono text-sm'>{shortenCID(root)}</Link>,
        <ChevronRightIcon key='>2' className='w-8 inline-block align-middle mb-1 px-2 py-0' />,
        <span key={shard.toString()} title={`Shard: ${root}`} className='font-mono text-sm'>{shortenCID(shard)}</span>
      )
    } else {
      crumbs.push(
        <span key={root.toString()} title={`Upload: ${root}`} className='font-mono text-sm'>{shortenCID(root)}</span>
      )
    }
  } else {
    crumbs.push(
      <span key={space} title={`Space: ${space}`} className='font-mono text-sm'>{shortenDID(space)}</span>
    )
  }

  return <div className='mb-6 bg-opacity-80 bg-white text-hot-red py-2 px-5 rounded-full break-words max-w-4xl shadow-inner'>{crumbs}</div>
}
