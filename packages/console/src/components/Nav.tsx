'use client'

import { PropsWithChildren } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Cog8ToothIcon } from '@heroicons/react/24/outline'

export function Nav ({ children, ...rest}: PropsWithChildren & { className?: string }) {
  return (
    <nav {...rest}>
      <div className="bg-hot-red-light inline-flex rounded-full border-2 border-hot-red font-semibold text-white overflow-hidden p-1">
        {children}
        <NavLink href='/settings' title='Account settings'><Cog8ToothIcon className='w-5 inline-block' /> Settings</NavLink>
      </div>
    </nav>
  )
}

export function NavLink ({ href, title, children }: PropsWithChildren & { href: string, title: string }) {
  const pathname = usePathname()
  const active = href === pathname ? 'bg-hot-red text-white' : 'bg-white hover:bg-hot-red hover:text-white text-hot-red'
  const cls = `inline-block px-5 py-2 mr-1 last:mr-0 font-epilogue text-md uppercase focus:relative ${active} bg-clip-padding rounded-full` 
  return (<Link className={cls} href={href} title={title}>{children}</Link>)
}
