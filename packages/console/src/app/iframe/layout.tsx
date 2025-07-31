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
  )
} 