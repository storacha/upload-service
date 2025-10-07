import './globals.css'
import type { Metadata } from 'next'
import Provider from '@/components/W3UIProvider'
import Toaster from '@/components/Toaster'
import { IframeProvider } from '@/contexts/IframeContext'
import PlausibleProvider from 'next-plausible' 

export const metadata: Metadata = {
  title: 'Storacha console',
  description: 'Storacha management console',
}

export default function RootLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin='anonymous' />
        <link href="https://fonts.googleapis.com/css2?family=Epilogue:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body className='bg-hot-red-light min-h-screen'>
      <PlausibleProvider
          domain='console.storacha.network'
          trackFileDownloads={true}
          trackOutboundLinks={true}
          taggedEvents={true}
          trackLocalhost={true}
          enabled={true}
        >
          <IframeProvider>
            <Provider>
              {children}
            </Provider>
            <Toaster />
          </IframeProvider>
        </PlausibleProvider>
      </body>
    </html>
  )
}