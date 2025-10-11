'use client'

import { SharingManager } from '@/components/SharingManager'

export default function SharePage ({params}): JSX.Element {
  return (
    <SharingManager spaceDID={decodeURIComponent(params.did)}/>
  )
}
