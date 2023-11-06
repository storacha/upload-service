'use client'

import { ImportSpace } from '@/share'
import { SpacesNav } from '../layout'
import { H2 } from '@/components/Text'

export default function ImportPage (): JSX.Element {
  return (
    <>
      <SpacesNav />
      <H2>Import a Space</H2>
      <ImportSpace />
    </>
  )
}
