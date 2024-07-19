'use client'

import { useW3, Space } from '@w3ui/react'
import { DidIcon } from '@/components/DidIcon'
import Link from 'next/link'
import { SpacesNav } from './space/layout'
import { H1, H2 } from '@/components/Text'
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
  const [{ spaces }] = useW3()

  if (spaces.length === 0) {
    return <div></div>
  }

  return (
    <>
      <SpacesNav />
      <H1>Spaces</H1>
      <H2>Pick a Space</H2>
      <div className='max-w-lg border rounded-2xl border-hot-red bg-white'>
        { spaces.map(s => <Item space={s} key={s.did()} /> ) }
      </div>
    </>
  )
}

function Item ({space}: {space: Space}) {
  return (
    <Link href={`/space/${space.did()}`} className='flex flex-row items-start gap-4 p-4 text-hot-red text-left hover:bg-hot-yellow-light border-b last:border-0 border-hot-red first:rounded-t-2xl last:rounded-b-2xl'>
      <DidIcon did={space.did()} />
      <div className='grow overflow-hidden whitespace-nowrap text-ellipsis'>
        <span className='font-epilogue text-lg font-semibold leading-5 m-0'>
          {space.name || 'Untitled'}
        </span>
        <span className='font-mono text-xs block'>
          {space.did()}
        </span>
      </div>
    </Link>
  )
}
