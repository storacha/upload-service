'use client'

import { PropsWithChildren } from 'react'
import { DIDKey } from '@ucanto/interface'
import { useKeyring } from '@w3ui/react-keyring'
import { DidIcon } from '@/components/DidIcon'
import Link from 'next/link'
import { Nav, NavLink } from '@/components/Nav'

interface LayoutProps extends PropsWithChildren {
  params: {
    did: string
  }
}

export default function Layout ({children, params}: LayoutProps): JSX.Element {
  const [{ space }, { setCurrentSpace }] = useKeyring()
  
  if (!params.did) {
    return <h1>NO SPACE?</h1>
  }

  const did = decodeDidKey(params.did)

  if (space && space?.did() !== did) {
    setCurrentSpace(did)
    return <div></div>
  }

  if (!space) {
    return <div></div>
  }

  return (
    <section>
      <header className='py-3'>
        <div className='flex flex-row items-start gap-2'>
          <DidIcon did={space.did()} />
          <div className='grow overflow-hidden whitespace-nowrap text-ellipsis text-gray-500'>
            <h1 className='text-lg font-semibold leading-5 text-white'>
              {space.name() ?? 'Untitled'}
            </h1>
            <label className='font-mono text-xs'>
              {space.did()}
            </label>
          </div>
        </div>
      </header>
      <Nav className='mb-8'>
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

function decodeDidKey (str: string): DIDKey | undefined {
  if (!str) return
  const did = decodeURIComponent(str)
  if (!did.startsWith('did:key:')) return
  return did as DIDKey
}
