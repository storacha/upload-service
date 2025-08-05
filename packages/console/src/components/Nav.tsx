'use client'

import { PropsWithChildren } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Cog8ToothIcon } from '@heroicons/react/24/outline'

export function Nav ({ children, ...rest}: PropsWithChildren & { className?: string }) {
  return (
    <nav {...rest} className={`w-full ${rest.className || ''}`}>
      <div className="bg-hot-red-light rounded-full border-2 border-hot-red font-semibold text-white overflow-hidden p-1 w-full">
        <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
          <div className="inline-flex gap-1 px-1">
            {children}
            <NavLink href='/settings' title='Account settings'><Cog8ToothIcon className='w-5 inline-block' /> Settings</NavLink>
          </div>
        </div>
      </div>
    </nav>
  )
}

export function NavLink ({ href, title, children }: PropsWithChildren & { href: string, title: string }) {
  const pathname = usePathname()
  const active = href === pathname ? 'bg-hot-red text-white' : 'bg-white hover:bg-hot-red hover:text-white text-hot-red'
  const cls = `inline-block px-4 py-2 font-epilogue text-sm sm:text-md uppercase focus:relative ${active} bg-clip-padding rounded-full whitespace-nowrap flex-shrink-0` 
  return (<Link className={cls} href={href} title={title}>{children}</Link>)
}
