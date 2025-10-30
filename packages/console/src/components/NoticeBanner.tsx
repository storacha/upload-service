'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface NoticeBannerProps {
  text: string
  href: string
  displayUntil: string
  dismissible?: boolean
  show?: boolean
}

export function NoticeBanner({
  text,
  href,
  displayUntil,
  dismissible = true,
  show = false,
}: NoticeBannerProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if banner should be visible based on date
    const shouldShow = new Date(displayUntil).getTime() > Date.now()

    // Check if user has dismissed this banner (using displayUntil as unique key)
    const dismissedKey = `notice-dismissed-${displayUntil}`
    const wasDismissed = localStorage.getItem(dismissedKey) === 'true'

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsVisible(show && shouldShow && !wasDismissed)
  }, [displayUntil, show])

  const handleDismiss = () => {
    if (dismissible) {
      // Store dismissal with displayUntil as unique key
      const dismissedKey = `notice-dismissed-${displayUntil}`
      localStorage.setItem(dismissedKey, 'true')
      setIsVisible(false)
    }
  }
  const [time] = useState(() => Date.now())

  // Don't show if not enabled, past expiration date, or dismissed
  if (!isVisible || new Date(displayUntil).getTime() <= time) {
    return null
  }

  const hasValidHref = href && href.trim() !== ''

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-hot-red text-white py-0.5 shadow-md">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center justify-center">
            {hasValidHref ? (
              <Link
                href={href}
                className="font-epilogue text-sm font-medium text-center uppercase tracking-wide text-white no-underline"
                dangerouslySetInnerHTML={{ __html: text }}
              />
            ) : (
              <p
                className="font-epilogue text-sm font-medium text-center uppercase tracking-wide text-white cursor-default"
                dangerouslySetInnerHTML={{ __html: text }}
              />
            )}
          </div>
          {dismissible && (
            <div className="order-3 mt-1 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
              <div className="flex rounded-md justify-center sm:justify-end">
                <button
                  type="button"
                  className="flex p-1.5 rounded-md hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-current transition-colors duration-200"
                  onClick={handleDismiss}
                  aria-label="Dismiss notification"
                >
                  <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}