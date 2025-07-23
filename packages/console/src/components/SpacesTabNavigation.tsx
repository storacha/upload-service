import { LockClosedIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DefaultLoader from './Loader'

interface SpacesTabNavigationProps {
  activeTab: 'public' | 'private'
  onTabChange: (tab: 'public' | 'private') => void
  showPrivateTab: boolean
  privateTabLocked: boolean
}

export function SpacesTabNavigation({ 
  activeTab, 
  onTabChange, 
  showPrivateTab, 
  privateTabLocked 
}: SpacesTabNavigationProps) {
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false)
  const router = useRouter()

  const handleUpgradeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsUpgradeLoading(true)
    router.push('/plans/change')
  }

  return (
    <div className="flex border-b border-gray-200 mb-6">
      <button
        onClick={() => onTabChange('public')}
        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
          activeTab === 'public'
            ? 'border-hot-red text-hot-red'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <GlobeAltIcon className="w-4 h-4" />
        Public
      </button>
      
      {showPrivateTab && (
        <button
          onClick={() => !privateTabLocked && onTabChange('private')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'private'
              ? 'border-hot-red text-hot-red'
              : privateTabLocked
                ? 'border-transparent text-gray-600 cursor-not-allowed'
                : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <LockClosedIcon className="w-4 h-4" />
          Private
          {privateTabLocked && (
            <button 
              onClick={handleUpgradeClick}
              disabled={isUpgradeLoading}
              className="bg-hot-red text-white px-2 py-1 rounded-full text-xs ml-1 hover:bg-white hover:text-hot-red border border-hot-red transition-colors cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isUpgradeLoading ? (
                <>
                  <DefaultLoader className="w-3 h-3" />
                  <span>Loading...</span>
                </>
              ) : (
                'Upgrade'
              )}
            </button>
          )}
        </button>
      )}
    </div>
  )
} 
