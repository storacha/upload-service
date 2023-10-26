'use client'

import { useKeyring, Space } from '@w3ui/react-keyring'
import { DidIcon } from '@/components/DidIcon'
import Link from 'next/link'
import { SpacesNav } from './space/layout'

export default function SpacePage (): JSX.Element {
  const [{ spaces }] = useKeyring()

  if (spaces.length === 0) {
    return <div></div>
  }

  return (
    <>
      <SpacesNav />
      <div className='max-w-lg mt-8'>
        { spaces.map(s => <Item space={s} key={s.did()} /> ) }
      </div>
    </>
  )
}

function Item ({space}: {space: Space}) {
  return (
    <Link href={`/space/${space.did()}`} className='flex flex-row items-start gap-2 p-2 text-left hover:bg-gray-800'>
      <DidIcon did={space.did()} />
      <div className='grow overflow-hidden whitespace-nowrap text-ellipsis text-gray-500'>
        <span className='text-lg font-semibold leading-5 text-white m-0'>
          {space.name() ?? 'Untitled'}
        </span>
        <span className='font-mono text-xs block'>
          {space.did()}
        </span>
      </div>
    </Link>
  )
}
