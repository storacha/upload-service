import { ReactNode } from 'react'

export interface TabConfig {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  badge?: string | number
  className?: string
}

export interface SpacesTabNavigationProps {
  activeTab: string
  onTabChange: (tabId: string) => void
  tabs?: TabConfig[]
  showPrivateTab?: boolean
  privateTabLocked?: boolean
  onUpgradeClick?: () => void
  className?: string
  variant?: 'underline' | 'pills' | 'bordered'
  renderTab?: (tab: TabConfig, isActive: boolean) => ReactNode
  upgradeButton?: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function SpacesTabNavigation({
  activeTab,
  onTabChange,
  tabs,
  showPrivateTab = true,
  privateTabLocked = false,
  onUpgradeClick,
  className = '',
  variant = 'underline',
  renderTab,
  upgradeButton,
  position = 'top'
}: SpacesTabNavigationProps): ReactNode {
  const defaultTabs: TabConfig[] = [
    {
      id: 'public',
      label: 'Public',
      icon: '🌐',
    },
    ...(showPrivateTab ? [{
      id: 'private',
      label: 'Private',
      icon: '🔒',
      disabled: privateTabLocked,
    }] : [])
  ]

  const tabsToRender = tabs || defaultTabs

  const handleTabClick = (tab: TabConfig) => {
    if (tab.disabled) {
      if (tab.id === 'private' && onUpgradeClick) {
        onUpgradeClick()
      }
      return
    }
    onTabChange(tab.id)
  }

  const getTabClassName = (tab: TabConfig, isActive: boolean) => {
    const baseClass = 'tab-item'
    const variantClass = `tab-${variant}`
    const activeClass = isActive ? 'active' : ''
    const disabledClass = tab.disabled ? 'disabled' : ''
    
    return `${baseClass} ${variantClass} ${activeClass} ${disabledClass} ${tab.className || ''}`.trim()
  }

  const defaultRenderTab = (tab: TabConfig, isActive: boolean) => (
    <button
      key={tab.id}
      className={getTabClassName(tab, isActive)}
      onClick={() => handleTabClick(tab)}
      disabled={tab.disabled && tab.id !== 'private'}
      type="button"
    >
      {tab.icon && <span className="tab-icon">{tab.icon}</span>}
      <span className="tab-label">{tab.label}</span>
      
      {tab.badge && (
        <span className="tab-badge">{tab.badge}</span>
      )}
      
      {tab.id === 'private' && privateTabLocked && (
        upgradeButton || (
          <span className="tab-upgrade-badge">
            Upgrade
          </span>
        )
      )}
    </button>
  )

  const tabsContent = (
    <>
      {tabsToRender.map((tab) => {
        const isActive = activeTab === tab.id
        return renderTab 
          ? <div key={tab.id}>{renderTab(tab, isActive)}</div>
          : defaultRenderTab(tab, isActive)
      })}
    </>
  )

  const positionClasses = {
    top: 'tabs-top',
    bottom: 'tabs-bottom',
    left: 'tabs-left',
    right: 'tabs-right'
  }

  return (
    <div className={`spaces-tab-navigation ${positionClasses[position]} ${className}`}>
      <div className={`tabs-container tabs-${variant}`}>
        {tabsContent}
      </div>
    </div>
  )
}
