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
    <div className="bg-white rounded-lg card-shadow p-1 mb-6 inline-flex">
      <button
        onClick={() => onTabChange('public')}
        className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-md font-medium transition-all-smooth ${
          activeTab === 'public'
            ? 'bg-hot-red text-white card-shadow'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <GlobeAltIcon className="w-4 h-4 md:w-5 md:h-5" />
        <span className="text-sm md:text-base">Public Spaces</span>
      </button>
      
      {showPrivateTab && (
        <button
          onClick={() => !privateTabLocked && onTabChange('private')}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-md font-medium transition-all-smooth ${
            activeTab === 'private'
              ? 'bg-hot-red text-white card-shadow'
              : privateTabLocked
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <LockClosedIcon className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-sm md:text-base">Private Spaces</span>
          {privateTabLocked && (
            <button 
              onClick={handleUpgradeClick}
              disabled={isUpgradeLoading}
              className="bg-gradient-to-r from-hot-red to-red-600 text-white px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs ml-1 md:ml-2 hover:from-red-600 hover:to-red-700 transition-all-smooth disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-1 md:gap-1.5 font-semibold"
            >
              {isUpgradeLoading ? (
                <>
                  <DefaultLoader className="w-3 h-3" />
                  <span className="hidden md:inline">Loading...</span>
                </>
              ) : (
                <span className="hidden md:inline">Upgrade</span>
              )}
            </button>
          )}
        </button>
      )}
    </div>
  )
} 
