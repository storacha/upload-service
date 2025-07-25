'use client'

import { useState } from 'react'
import { useW3 } from '@storacha/ui-react'
import { SpacesNav } from './space/layout'
import { H1 } from '@/components/Text'
import SidebarLayout from '@/components/SidebarLayout'
import { SpacesTabNavigation } from '@/components/SpacesTabNavigation'
import { SpacesList } from '@/components/SpacesList'
import { UpgradePrompt } from '@/components/UpgradePrompt'
import { usePrivateSpacesAccess } from '@/hooks/usePrivateSpacesAccess'
import { useFeatureFlags } from '@/lib/featureFlags'
import { useFilteredSpaces } from '@/hooks/useFilteredSpaces'

export default function HomePage() {
  return (
    <SidebarLayout>
      <SpacePage />
    </SidebarLayout>
  )
}

export function SpacePage() {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public')
  const [{ spaces }] = useW3()
  const { canAccessPrivateSpaces, shouldShowUpgradePrompt, planLoading } = usePrivateSpacesAccess()
  const { canSeePrivateSpacesFeature } = useFeatureFlags()
  const { publicSpaces, privateSpaces, hasHiddenPrivateSpaces } = useFilteredSpaces()

  const shouldShowPrivateSpacesTab = canSeePrivateSpacesFeature

  if (spaces.length === 0) {
    return <div></div>
  }

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <>
      <SpacesNav />
      <H1>Spaces</H1>
      <SpacesTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showPrivateTab={shouldShowPrivateSpacesTab}
        privateTabLocked={!canAccessPrivateSpaces}
      />
      {activeTab === 'public' && (
        <SpacesList spaces={publicSpaces} type="public" />
      )}
      {activeTab === 'private' && (
        canAccessPrivateSpaces ? (
          <SpacesList spaces={privateSpaces} type="private" />
        ) : (
          <UpgradePrompt hasHiddenSpaces={hasHiddenPrivateSpaces} />
        )
      )}
    </>
  )
}

