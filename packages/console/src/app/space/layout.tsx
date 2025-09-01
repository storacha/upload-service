import { PropsWithChildren, ReactNode } from 'react'
import { Nav, NavLink } from '@/components/Nav'
import SidebarLayout from '@/components/SidebarLayout'
import { ArrowDownOnSquareStackIcon, QueueListIcon, FolderPlusIcon, Cog8ToothIcon } from '@heroicons/react/24/outline'

export const runtime = 'edge'

interface LayoutProps extends PropsWithChildren {
  params: {
    did: string
  }
}

export default function Layout ({children}: LayoutProps): ReactNode {
  return (
    <SidebarLayout>
      {children}
    </SidebarLayout>
  )
}



export function SpacesNav () {
  return (
    <div className='lg:float-right'>
      <Nav>
        <NavLink href='/'><QueueListIcon className='w-4 h-4 md:w-5 md:h-5' /> Spaces</NavLink>
        <NavLink href='/space/import'><ArrowDownOnSquareStackIcon className='w-4 h-4 md:w-5 md:h-5' /> Import</NavLink>
        <NavLink href='/space/create'><FolderPlusIcon className='w-4 h-4 md:w-5 md:h-5' /> Create</NavLink>
        <NavLink href='/settings'><Cog8ToothIcon className='w-4 h-4 md:w-5 md:h-5' /> Settings</NavLink>
      </Nav>
    </div>
  )
}