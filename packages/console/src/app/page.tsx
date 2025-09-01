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
  const { canAccessPrivateSpaces, planLoading, shouldShowPrivateSpacesTab } = usePrivateSpacesAccess()
  const { publicSpaces, privateSpaces, hasHiddenPrivateSpaces } = useFilteredSpaces()

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
    <div className="max-w-7xl mx-auto">
      <SpacesNav />
      
      {/* Professional Header */}
      <div className="mb-6">
        <H1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Your Spaces</H1>
        <p className="text-sm md:text-lg text-slate-800 font-medium">
          Manage your storage spaces and organize your files with ease.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <SpacesTabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showPrivateTab={shouldShowPrivateSpacesTab}
          privateTabLocked={!canAccessPrivateSpaces}
        />
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
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
      </div>
    </div>
  )
}

