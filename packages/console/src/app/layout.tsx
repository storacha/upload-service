import SidebarLayout from '@/components/SidebarLayout'
import './globals.css'
import type { Metadata } from 'next'
import { H2 } from '@/components/Text'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'w3up console',
  description: 'web3.storage file uploader',
}

export default function RootLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className='bg-gray-dark min-h-screen'>
        <SidebarLayout>
          <H2 explain='a decentralised bucket identified by a DID'>
            <Link href='/'>Space</Link>
          </H2>
          {children}
        </SidebarLayout>
      </body>
    </html>
  )
}
