import './globals.css'
import type { Metadata } from 'next'
import Provider from '@/components/W3UIProvider'
import Toaster from '@/components/Toaster'
import { Provider as MigrationsProvider } from '@/components/MigrationsProvider'

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
          <MigrationsProvider>
            {children}
          </MigrationsProvider>
        </Provider>
        <Toaster />
      </body>
    </html>
  )
}
