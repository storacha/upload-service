'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSpaceAccess } from '@/hooks/useSpaceAccess'
import Loader from './Loader'

interface PrivateSpaceGuardProps {
  spaceDID: string
  children: React.ReactNode
  redirectTo?: string
}

export function PrivateSpaceGuard({ 
  spaceDID, 
  children, 
  redirectTo = '/plans/change'
}: PrivateSpaceGuardProps) {
  const router = useRouter()
  const { hasAccess, isLoading } = useSpaceAccess(spaceDID)
  
  useEffect(() => {
    if (!isLoading && !hasAccess) {
      router.push(redirectTo)
    }
  }, [hasAccess, isLoading, router, redirectTo])
  
  // Show loading state while checking access
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader />
      </div>
    )
  }
  
  // Only render children if user has access
  return hasAccess ? <>{children}</> : null
}
