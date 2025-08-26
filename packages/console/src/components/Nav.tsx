'use client'

import { usePathname } from "next/navigation"
import Link from "next/link"

export function Nav ({ children }: { children: React.ReactNode }) {
  return <nav className='bg-white rounded-xl card-shadow p-1.5 md:p-2 mb-6 md:mb-8 flex gap-1.5 md:gap-2'>{children}</nav>
}

export function NavLink ({ href, children, className = '' }: { href: string, children: React.ReactNode, className?: string }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
  
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium transition-all-smooth text-sm md:text-base ${
        isActive
          ? 'bg-hot-red text-white card-shadow'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      } ${className}`}
    >
      {children}
    </Link>
  )
}
