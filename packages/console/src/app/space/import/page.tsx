'use client'

import { ImportSpace } from '@/share'
import { SpacesNav } from '../layout'
import { H1 } from '@/components/Text'

export default function ImportPage (): JSX.Element {
  return (
    <>
      <SpacesNav />
      <H1>Import a Space</H1>
      <ImportSpace />
    </>
  )
}
