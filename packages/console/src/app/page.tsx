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
import { useSpaceSort } from '@/hooks/useSpaceSort'
import { SpaceSortDropdown } from '@/components/SpaceSortDropdown'
import { NoticeBanner } from '@/components/NoticeBanner'
import { noticeConfig } from '@/config/notice'

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
  const { sortOption, setSortOption } = useSpaceSort()
  const { publicSpaces, privateSpaces, hasHiddenPrivateSpaces } = useFilteredSpaces(sortOption)

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
      {/* Banner at the top of main content - only shown if enabled */}
      <NoticeBanner
        show={noticeConfig.enabled}
        text={noticeConfig.text}
        href={noticeConfig.href}
        displayUntil={noticeConfig.displayUntil}
        dismissible={noticeConfig.dismissible}
      />

      <SpacesNav />
      <H1>Spaces</H1>
      <SpacesTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showPrivateTab={shouldShowPrivateSpacesTab}
        privateTabLocked={!canAccessPrivateSpaces}
      />
      <div className="mb-4">
        <SpaceSortDropdown sortOption={sortOption} onSortChange={setSortOption} />
      </div>
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