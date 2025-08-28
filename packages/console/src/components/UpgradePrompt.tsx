import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  LockClosedIcon, 
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  EyeSlashIcon,
  CloudIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline'
import DefaultLoader from './Loader'

interface UpgradePromptProps {
  hasHiddenSpaces?: boolean
}

export function UpgradePrompt({ hasHiddenSpaces = false }: UpgradePromptProps) {
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false)
  const router = useRouter()

  const handleUpgradeClick = () => {
    setIsUpgradeLoading(true)
    router.push('/plans/change')
  }

  return (
    <div className="bg-white rounded-xl card-shadow p-4 md:p-8 text-center">
      <div className="mb-4 md:mb-6">
        <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
          <LockClosedIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 md:mb-3">Unlock Private Spaces</h3>
        <p className="text-slate-600 text-sm md:text-lg">
          Upgrade your plan to create and access private spaces with enhanced security and encryption.
        </p>
      </div>

      {hasHiddenSpaces && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex items-center justify-center gap-2 text-amber-800">
            <ExclamationTriangleIcon className="w-4 h-4 md:w-5 md:h-5" />
            <p className="font-medium text-sm md:text-base">
              You have private spaces that are currently hidden. 
              Upgrade to access them again.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-slate-50 rounded-lg">
          <ShieldCheckIcon className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0" />
          <span className="text-slate-700 font-medium text-sm md:text-base">End-to-end encryption</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-slate-50 rounded-lg">
          <EyeSlashIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600 flex-shrink-0" />
          <span className="text-slate-700 font-medium text-sm md:text-base">Private access control</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-slate-50 rounded-lg">
          <CloudIcon className="w-5 h-5 md:w-6 md:h-6 text-purple-600 flex-shrink-0" />
          <span className="text-slate-700 font-medium text-sm md:text-base">Secure cloud storage</span>
        </div>
      </div>

      <button
        onClick={handleUpgradeClick}
        disabled={isUpgradeLoading}
        className="bg-gradient-to-r from-hot-red to-red-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-semibold text-base md:text-lg hover:from-red-600 hover:to-red-700 transition-all-smooth disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-2 md:gap-3 mx-auto card-shadow-hover"
      >
        {isUpgradeLoading ? (
          <>
            <DefaultLoader className="w-4 h-4 md:w-5 md:h-5" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            <ArrowUpIcon className="w-4 h-4 md:w-5 md:h-5" />
            <span>Upgrade Now</span>
          </>
        )}
      </button>
    </div>
  )
}
