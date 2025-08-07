'use client'

import { PropsWithChildren } from 'react'
import { useW3 } from '@storacha/ui-react'
import { DidIcon } from '@/components/DidIcon'
import { Nav, NavLink } from '@/components/Nav'
import { QueueListIcon, ShareIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

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
    return <h1 className='text-center text-2xl text-hot-red flex flex-col gap-4'>
      <h1>Space not found: {spaceDID}</h1>
      <Link href='/' className="underline">Back to spaces</Link>
    </h1>
  }

  return (
    <section>
      <div className='lg:float-right'>
        <Nav>
          <NavLink href={`/space/${space.did()}`} title='List uploads'><QueueListIcon className='w-5 inline-block' /> Uploads</NavLink>
          <NavLink href={`/space/${space.did()}/share`} title='Share this Space'><ShareIcon className='w-5 inline-block' /> Share</NavLink>
          <NavLink href={`/space/${space.did()}/upload`} title='Upload a file'><CloudArrowUpIcon className='w-5 inline-block' /> Upload</NavLink>
        </Nav>
      </div>
      <header className='mt-4 mb-10 inline-block'>
        <div className='flex flex-row items-start gap-4'>
          <DidIcon did={space.did()} width={10} />
          <div className='grow overflow-hidden whitespace-nowrap text-ellipsis text-black'>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl leading-5 text-hot-red'>
                {space.name || 'Untitled'}
              </h1>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${space.access?.type === 'private' ? 'bg-hot-red text-white' : 'bg-blue-500 text-white'}`}>
                {space.access?.type === 'private' ? 'Private' : 'Public'}
              </span>
            </div>
            <label className='font-mono text-xs'>
              {space.did()}
            </label>
          </div>
        </div>
      </header>
      
      <div className='max-w-7xl'>
        {children}
      </div>
    </section>
  )
}
