'use client'

import { SpaceCreatorForm } from '@/components/SpaceCreator'
import { SpacesNav } from '../layout'

export default function CreateSpacePage (): JSX.Element {
  return (
    <>
      <SpacesNav />
      <div className='max-w-xl'>
        <SpaceCreatorForm />
      </div>
    </>
  )
}
