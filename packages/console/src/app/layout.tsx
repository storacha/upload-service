import './globals.css'
import type { Metadata } from 'next'
import Provider from '@/components/W3UIProvider'
import Toaster from '@/components/Toaster'

export const metadata: Metadata = {
  title: 'w3up console',
  description: 'web3.storage management console',
}

export default function RootLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className='bg-grad min-h-screen'>
        <Provider>
          <>{children}</>
        </Provider>
        <Toaster />
      </body>
    </html>
  )
}
