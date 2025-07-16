import { LockClosedIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { H2, H3 } from './Text'
import Link from 'next/link'

interface UpgradePromptProps {
  hasHiddenSpaces?: boolean
}

export function UpgradePrompt({ hasHiddenSpaces = false }: UpgradePromptProps) {
  return (
    <div className="border border-hot-red rounded-2xl bg-white p-8 max-w-4xl">
      <div className="text-center">
        <LockClosedIcon className="w-16 h-16 text-hot-red mx-auto mb-4" />
        <H2>Upgrade to Access Private Spaces</H2>
        
        {hasHiddenSpaces && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
              You have private spaces that are currently hidden. 
              Upgrade to access them again.
            </p>
          </div>
        )}
        
        <p className="font-epilogue mb-6 text-gray-600">
          Private spaces allow you to encrypt files locally before upload, 
          ensuring only you can access your data.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <H3>Private Spaces Features:</H3>
          <ul className="text-left text-sm space-y-2 mt-2">
            <li>• Client-side encryption before upload</li>
            <li>• Files are encrypted with your local keys</li>
            <li>• Decrypt and download files securely</li>
            <li>• Complete privacy and control over your data</li>
          </ul>
        </div>
        
        <Link 
          href="/plans/change" 
          className="inline-block bg-hot-red text-white px-8 py-3 rounded-full font-epilogue uppercase hover:bg-white hover:text-hot-red border border-hot-red transition-colors"
        >
          Upgrade Now
        </Link>
      </div>
    </div>
  )
} 
