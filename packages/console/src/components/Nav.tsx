'use client'

import { PropsWithChildren } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function Nav ({ children, ...rest}: PropsWithChildren & { className?: string }) {
  return (
    <nav {...rest}>
      <ul className="flex max-w-lg pt-4">
        {children}
      </ul>
    </nav>
  )
}

export function NavLink ({ href, children }: PropsWithChildren & { href: string }) {
  const pathname = usePathname()
  const active = href === pathname ? 'active' : ''
  const cls = `w3ui-button inline-block ${active}` 
  return (
    <li className="mr-3">
      <Link className={cls} href={href}>{children}</Link>
    </li>
  )
}
