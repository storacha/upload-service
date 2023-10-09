'use client'

import { useState } from 'react'
import { DIDKey } from '@ucanto/interface'
import { useKeyring } from '@w3ui/react-keyring'

import { AuthenticationEnsurer } from '../components/Authenticator'
import { DefaultLayout } from '../components/Layout'
import { SpaceEnsurer } from '../components/SpaceEnsurer'
import { SpaceSection } from '../components/SpaceSection'
import { SpaceSelector } from '../components/SpaceSelector'

export default function Home (): JSX.Element {
  const [share, setShare] = useState(false)
  const [{ space, spaces }, { setCurrentSpace }] = useKeyring()

  function viewSpace (did: DIDKey): void {
    setShare(false)
    void setCurrentSpace(did)
  }

  return (
    <SpaceSection viewSpace={viewSpace} share={share} setShare={setShare} />
  )
}


