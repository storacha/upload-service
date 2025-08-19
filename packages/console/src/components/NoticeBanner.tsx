'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface NoticeBannerProps {
  text: string
  href: string
  dismissible?: boolean
}

export function NoticeBanner({ 
  text, 
  href, 
  dismissible = true 
}: NoticeBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    if (dismissible) {
      setIsVisible(false)
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="relative bg-hot-red text-white mb-10">
      <div className="px-3 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center justify-center">
            <p className="font-epilogue text-sm font-medium text-center uppercase tracking-wide">
              <Link 
                href={href} 
                className="hover:opacity-80 transition-opacity duration-200"
                dangerouslySetInnerHTML={{ __html: text }}
              />
            </p>
          </div>
          {dismissible && (
            <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
              <div className="flex rounded-md justify-center sm:justify-end">
                <button
                  type="button"
                  className="flex p-2 rounded-md hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-current transition-colors duration-200"
                  onClick={handleDismiss}
                  aria-label="Dismiss notification"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}