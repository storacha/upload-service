import { PropsWithChildren } from 'react'
import { Nav, NavLink } from '@/components/Nav'
import { UsageBar } from '@/components/UsageBar'

export const runtime = 'edge'

interface LayoutProps extends PropsWithChildren {
  params: {
    did: string
  }
}

export default function Layout ({children}: LayoutProps): JSX.Element {
  return (
    <>
      {children}
    </>
  )
}



export function SpacesNav () {
  return (
    <>
      <div className='lg:flex items-center place-items-center justify-between mt-2 mb-8'>
        <div className='lg:w-2/6 order-last'>
          <UsageBar />
        </div>
        <Nav>
          <NavLink href='/'>List</NavLink>
          <NavLink href='/space/import'>Import</NavLink>
          <NavLink href='/space/create'>Create</NavLink>
        </Nav>
      </div>
    </>
  )
}