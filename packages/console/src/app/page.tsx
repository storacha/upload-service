'use client'

import { useKeyring, Space } from '@w3ui/react-keyring'
import { DidIcon } from '@/components/DidIcon'
import Link from 'next/link'
import { SpacesNav } from './space/layout'
import { H2 } from '@/components/Text'
import SidebarLayout from '@/components/SidebarLayout'
import { ReactNode } from 'react'

export default function HomePage () {
  return (
    <SidebarLayout>
      <SpacePage />
    </SidebarLayout>
  )
}

function SpacePage (): ReactNode {
  const [{ spaces }] = useKeyring()

  if (spaces.length === 0) {
    return <div></div>
  }

  return (
    <>
      <SpacesNav />
      <H2>Pick a Space</H2>
      <div className='max-w-lg border rounded-md border-zinc-700'>
        { spaces.map(s => <Item space={s} key={s.did()} /> ) }
      </div>
    </>
  )
}

function Item ({space}: {space: Space}) {
  return (
    <Link href={`/space/${space.did()}`} className='flex flex-row items-start gap-2 p-3 text-white text-left bg-gray-900/30 hover:bg-gray-900/60 border-b last:border-0 border-zinc-700'>
      <DidIcon did={space.did()} />
      <div className='grow overflow-hidden whitespace-nowrap text-ellipsis'>
        <span className='text-md font-semibold leading-5 m-0'>
          {space.name() || 'Untitled'}
        </span>
        <span className='font-mono text-xs block'>
          {space.did()}
        </span>
      </div>
    </Link>
  )
}
