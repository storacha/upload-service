'use client'

import { PropsWithChildren } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function Nav ({ children, ...rest}: PropsWithChildren & { className?: string }) {
  return (
    <nav {...rest}>
      <div className="inline-flex rounded-md font-semibold text-white overflow-hidden">
        {children}
      </div>
    </nav>
  )
}

export function NavLink ({ href, children }: PropsWithChildren & { href: string }) {
  const pathname = usePathname()
  const active = href === pathname ? 'bg-gray-900/60' : 'bg-gray-900/40 hover:bg-gray-900/50 shadow-inner'
  const cls = `inline-block px-10 py-3 text-sm focus:relative ${active} bg-clip-padding border-r border-transparent last:border-0` 
  return (<Link className={cls} href={href}>{children}</Link>)
}
