import { PropsWithChildren, ReactNode } from 'react'
import { Nav, NavLink } from '@/components/Nav'
import SidebarLayout from '@/components/SidebarLayout'
import { ArrowDownOnSquareStackIcon, QueueListIcon, FolderPlusIcon } from '@heroicons/react/24/outline'

export const runtime = 'edge'

export default function Layout ({ children }: PropsWithChildren): ReactNode {
  return (
    <SidebarLayout>
      {children}
    </SidebarLayout>
  )
}

export function SettingsNav () {
  return (
    <div className='lg:float-right'>
      <Nav>
        <NavLink href='/' title='List Spaces'><QueueListIcon className='w-5 inline-block' /> Spaces</NavLink>
        <NavLink href='/space/import' title='Import an existing Space'><ArrowDownOnSquareStackIcon className='w-5 inline-block' /> Import</NavLink>
        <NavLink href='/space/create' title='Create a new Space'><FolderPlusIcon className='w-5 inline-block' /> Create</NavLink>
      </Nav>
    </div>
  )
}
