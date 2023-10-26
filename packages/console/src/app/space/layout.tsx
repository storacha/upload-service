import { PropsWithChildren } from 'react'
import { H2 } from '@/components/Text'
import Link from 'next/link'
import { Nav, NavLink } from '@/components/Nav'

export const runtime = 'edge'

interface LayoutProps extends PropsWithChildren {
  params: {
    did: string
  }
}

export default function Layout ({children}: LayoutProps): JSX.Element {
  return (
    <section>
      {children}
    </section>
  )
}



export function SpacesNav () {
  return (
    <>
      {/* <div style={{minHeight: 68}}>
        <p className='font-normal pt-4'>
          Pick a space to see what's in it, or create a new one.
        </p>
      </div> */}
      <Nav className='mb-8'>
        <NavLink href='/'>List</NavLink>
        <NavLink href='/space/import'>Import</NavLink>
        <NavLink href='/space/create'>Create</NavLink>
      </Nav>
    </>
  )
}