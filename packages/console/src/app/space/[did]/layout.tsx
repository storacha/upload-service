'use client'

import { PropsWithChildren } from 'react'
import { useW3 } from '@w3ui/react'
import { DidIcon } from '@/components/DidIcon'
import { Nav, NavLink } from '@/components/Nav'

interface LayoutProps extends PropsWithChildren {
  params: {
    did: string
  }
}

export default function Layout ({children, params}: LayoutProps): JSX.Element {
  const [{ spaces }] = useW3()
  
  if (!params.did) {
    return <h1>NO SPACE?</h1>
  }

  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)
  if (!space) {
    console.warn(`not a known space to this agent: ${spaceDID}`)
    return <div />
  }

  return (
    <section>
      <header className='py-3'>
        <div className='flex flex-row items-start gap-2'>
          <DidIcon did={space.did()} />
          <div className='grow overflow-hidden whitespace-nowrap text-ellipsis text-black'>
            <h1 className='text-lg font-semibold leading-5 text-black'>
              {space.name || 'Untitled'}
            </h1>
            <label className='font-mono text-xs'>
              {space.did()}
            </label>
          </div>
        </div>
      </header>
      <Nav className='mb-8 mt-8'>
        <NavLink href={`/space/${space.did()}`}>List</NavLink>
        <NavLink href={`/space/${space.did()}/share`}>Share</NavLink>
        <NavLink href={`/space/${space.did()}/upload`}>Upload</NavLink>
      </Nav>
      <div className='max-w-7xl'>
        {children}
      </div>
    </section>
  )
}
