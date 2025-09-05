import '../globals.css'
import type { Metadata } from 'next'
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
  )
} 