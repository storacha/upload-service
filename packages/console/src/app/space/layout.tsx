import { PropsWithChildren, ReactNode } from 'react'
import { Nav, NavLink } from '@/components/Nav'
import { UsageBar } from '@/components/UsageBar'
import SidebarLayout from '@/components/SidebarLayout'
import { ArrowDownOnSquareStackIcon, QueueListIcon, FolderPlusIcon } from '@heroicons/react/24/outline'

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
      {/* <div className='lg:w-2/6 order-last'>
        <UsageBar />
      </div> */}
      <Nav>
        <NavLink href='/' title='List Spaces'><QueueListIcon className='w-5 inline-block' /> List</NavLink>
        <NavLink href='/space/import' title='Import an existing Space'><ArrowDownOnSquareStackIcon className='w-5 inline-block' /> Import</NavLink>
        <NavLink href='/space/create' title='Create a new Space'><FolderPlusIcon className='w-5 inline-block' /> Create</NavLink>
      </Nav>
    </div>
  )
}