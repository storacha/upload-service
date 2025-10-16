'use client'

import React from 'react'
import { useW3 } from '@storacha/ui-react'
import { H2 } from '@/components/Text'
import { Breadcrumbs } from '@/components/Breadcrumbs'

interface PageProps {
  params: {
    did: string
  }
}

export default function SpaceSettingsPage({ params }: PageProps): JSX.Element {
  const [{ spaces }] = useW3()
  const spaceDID = decodeURIComponent(params.did)
  const space = spaces.find(s => s.did() === spaceDID)

  if (!space) {
    return <div>Space not found</div>
  }

  return (
    <>
      <Breadcrumbs space={space.did()} />
      <h1 className='text-2xl leading-5 text-hot-red mb-6'>
        Space Settings
      </h1>
      
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
        <H2>Space Management</H2>
        <button 
          onClick={() => window.open('https://forms.gle/UyxnioZtfj5qGLNj6', '_blank')}
          className='bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200'
        >
          Request Space Deletion
        </button>
      </div>
    </>
  )
}
