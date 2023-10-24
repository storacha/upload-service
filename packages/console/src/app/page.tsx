'use client'

import { useState } from 'react'
import { DIDKey } from '@ucanto/interface'
import { useKeyring } from '@w3ui/react-keyring'

import { SpaceSection } from '../components/SpaceSection'

export default function Home (): JSX.Element {
  const [share, setShare] = useState(false)
  const [, { setCurrentSpace }] = useKeyring()

  function viewSpace (did: DIDKey): void {
    setShare(false)
    void setCurrentSpace(did)
  }

  return (
    <SpaceSection viewSpace={viewSpace} share={share} setShare={setShare} />
  )
}


