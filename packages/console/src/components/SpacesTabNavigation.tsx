import { LockClosedIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

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
                ? 'border-transparent text-gray-300 cursor-not-allowed'
                : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <LockClosedIcon className="w-4 h-4" />
          Private
          {privateTabLocked && (
            <span className="bg-hot-red text-white px-2 py-1 rounded-full text-xs ml-1">
              Upgrade
            </span>
          )}
        </button>
      )}
    </div>
  )
} 
