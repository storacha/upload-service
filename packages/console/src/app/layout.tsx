import SidebarLayout from '@/components/SidebarLayout'
import './globals.css'
import type { Metadata } from 'next'

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
          {children}
        </SidebarLayout>
      </body>
    </html>
  )
}
