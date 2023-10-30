'use client'

import { PropsWithChildren } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function Nav ({ children, ...rest}: PropsWithChildren & { className?: string }) {
  return (
    <nav {...rest}>
      <div className="inline-flex rounded-sm border-zinc-600 bg-gray-800 mt-4 font-semibold">
        {children}
      </div>
    </nav>
  )
}

export function NavLink ({ href, children }: PropsWithChildren & { href: string }) {
  const pathname = usePathname()
  const active = href === pathname ? 'text-gray-900 bg-gray-100' : 'text-blue-100 hover:bg-gray-700'
  const cls = `inline-block rounded-sm px-9 py-2 text-sm focus:relative ${active}` 
  return (<Link className={cls} href={href}>{children}</Link>)
}
