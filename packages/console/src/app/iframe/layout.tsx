import '../globals.css'
import type { Metadata } from 'next'
import Provider from '@/components/W3UIProvider'
import Toaster from '@/components/Toaster'
import { Provider as MigrationsProvider } from '@/components/MigrationsProvider'
import { IframeProvider } from '@/contexts/IframeContext'
import IframeAuthenticator from '@/components/IframeAuthenticator'
import { IframeSidebarLayout } from '@/components/SidebarLayout'
import { AuthenticationEnsurer } from '@/components/Authenticator'
import { MaybePlanGate } from '@/components/PlanGate'
import { SpaceEnsurer } from '@/components/SpaceEnsurer'

export const metadata: Metadata = {
  title: 'Storacha Workspaces',
  description: 'Manage your Storacha storage spaces',
}

export default function IframeLayout({
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className='bg-hot-red-light min-h-screen overflow-hidden font-epilogue' style={{backgroundColor: 'var(--hot-red-light) !important'}}>
        <IframeProvider>
          <Provider>
            <MigrationsProvider>
              <IframeAuthenticator>
                <AuthenticationEnsurer>
                  <MaybePlanGate>
                    <SpaceEnsurer>
                      <IframeSidebarLayout>
                        {children}
                      </IframeSidebarLayout>
                    </SpaceEnsurer>
                  </MaybePlanGate>
                </AuthenticationEnsurer>
              </IframeAuthenticator>
            </MigrationsProvider>
          </Provider>
          <Toaster />
        </IframeProvider>
      </body>
    </html>
  )
} 