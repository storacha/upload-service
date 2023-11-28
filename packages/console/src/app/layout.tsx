import './globals.css'
import type { Metadata } from 'next'
import { W3APIProvider } from '@/components/W3API'

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
        <W3APIProvider uploadsListPageSize={20}>
          {children}
        </W3APIProvider>
      </body>
    </html>
  )
}
