'use client'

import { ShareSpace } from '@/share'

export default function SharePage ({params}): JSX.Element {
  return (
    <ShareSpace spaceDID={decodeURIComponent(params.did)}/>
  )
}
