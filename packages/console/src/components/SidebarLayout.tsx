'use client'

import { Logo } from '../brand'
import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { Authenticator, useW3, Space } from '@storacha/ui-react'
import { AuthenticationEnsurer } from '../components/Authenticator'
import { SpaceEnsurer } from '../components/SpaceEnsurer'
import { MaybePlanGate } from './PlanGate'
import { SpaceFinder } from './SpaceFinder'
import { usePathname, useRouter } from 'next/navigation'
import { H2 } from './Text'
import { SidebarMigrations } from './SidebarMigrations'

const navLinks = [
  { name: 'Terms', href: 'https://docs.storacha.network/terms/' },
  { name: 'Docs', href: 'https://docs.storacha.network/' },
  { name: 'Support', href: 'mailto:support@storacha.network' },
]

interface SidebarComponentProps {
  sidebar?: React.ReactNode
}


function Sidebar ({ sidebar = <div></div> }: SidebarComponentProps): JSX.Element {
  const [{ spaces }] = useW3()
  const router = useRouter()
  const pathname = usePathname()
  const spaceDID = pathname.startsWith('/space/') ? pathname.split('/')[2] : undefined
  const space = spaces.find(s => s.did() === spaceDID)

  const goToSpace = (s: Space) => {
    router.push(`/space/${s.did()}`)
  }
  return (
    <nav className='flex-none w-64 sidebar-professional text-white px-6 pb-6 border-r border-slate-300 min-h-screen'>
      <div className='flex flex-col justify-between h-full'>
        <div>
          <header className='opacity-0 lg:opacity-100 my-8'>
            <Logo className='pr-4 block' />
          </header>
          <div className='my-8'>
            <H2 className='text-slate-200 text-sm font-semibold uppercase tracking-wider mb-4'>Spaces</H2>
            <SpaceFinder spaces={spaces} selected={space} setSelected={goToSpace} />
          </div>
          <div className='my-8'>
            <SidebarMigrations />
          </div>
        </div>
        {sidebar}
        <div className='flex flex-col items-center border-t border-slate-600 pt-6'>
          <div className='flex flex-row flex-wrap justify-center gap-4'>
            {navLinks.map((link, i) => (
              <a key={i} className='text-xs text-slate-300 hover:text-white transition-colors' href={link.href}>{link.name}</a>
            ))}
            <a className='text-xs text-slate-300 hover:text-white transition-colors' href="/logout">
              Log Out
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}

interface LayoutComponentProps extends SidebarComponentProps {
  children: React.ReactNode
}

export default function SidebarLayout ({ children }: LayoutComponentProps): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <Authenticator className='h-full' as='div'>
      <AuthenticationEnsurer>
        <MaybePlanGate>
          <SpaceEnsurer>
            <div className='flex min-h-screen w-full text-white'>
              {/* dialog sidebar for narrow browsers */}
              <Transition.Root show={sidebarOpen} >
                <Dialog onClose={() => setSidebarOpen(false)} as='div' className='relative z-50'>
                  <Transition.Child
                    as={Fragment}
                    enter="transition-opacity duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-400"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
                  </Transition.Child>
                  <div className="fixed inset-0 flex justify-left">
                    <Transition.Child
                      as={Fragment}
                      enter="transition duration-200"
                      enterFrom="-translate-x-full"
                      enterTo="translate-x-0"
                      leave="transition duration-400"
                      leaveFrom="translate-x-0"
                      leaveTo="-translate-x-full">
                      <Dialog.Panel>
                        <XMarkIcon className='text-white w-6 h-6 fixed top-2 -right-8' onClick={() => setSidebarOpen(false)} />
                        <Sidebar />
                      </Dialog.Panel>
                    </Transition.Child>
                  </div>
                </Dialog>
              </Transition.Root>
              {/* static sidebar for wide browsers */}
              <div className='hidden lg:block'>
                <Sidebar />
              </div>
              <div className='bg-professional-branded w-full'>
                {/* top nav bar for narrow browsers, mainly to have a place to put the hamburger */}
                <div className='lg:hidden flex justify-between pt-6 px-6 bg-white card-shadow-lg'>
                  <Bars3Icon className='text-slate-600 w-6 h-6 hover:text-hot-red transition-colors cursor-pointer' onClick={() => setSidebarOpen(true)} />
                  <Logo className='w-full' />
                </div>
                <main className='grow text-slate-900 p-4 md:p-8 lg:p-12'>
                  {children}
                </main>
              </div>
            </div>
          </SpaceEnsurer>
        </MaybePlanGate>
      </AuthenticationEnsurer>
    </Authenticator>
  )
}

// Iframe-specific version that uses IframeAuthenticator
export function IframeSidebarLayout ({ children }: LayoutComponentProps): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className='flex min-h-screen w-full text-white'>
      {/* dialog sidebar for narrow browsers */}
      <Transition.Root show={sidebarOpen} >
        <Dialog onClose={() => setSidebarOpen(false)} as='div' className='relative z-50'>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-400"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
          </Transition.Child>
          <div className="fixed inset-0 flex justify-left">
            <Transition.Child
              as={Fragment}
              enter="transition duration-200"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition duration-400"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full">
              <Dialog.Panel>
                <XMarkIcon className='text-white w-6 h-6 fixed top-2 -right-8' onClick={() => setSidebarOpen(false)} />
                <Sidebar />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
      {/* static sidebar for wide browsers */}
      <div className='hidden lg:block'>
        <Sidebar />
      </div>
      <div className='bg-professional-branded w-full'>
        {/* top nav bar for narrow browsers, mainly to have a place to put the hamburger */}
        <div className='lg:hidden flex justify-between pt-4 px-4'>
          <Bars3Icon className='text-hot-red w-6 h-6' onClick={() => setSidebarOpen(true)} />
          <Logo className='w-full' />
        </div>
        <main className='grow text-black p-12'>
          {children}
        </main>
      </div>
    </div>
  )
}
