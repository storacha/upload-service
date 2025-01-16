'use client'

import { SpaceCreatorForm } from '@/components/SpaceCreator'
import { SpacesNav } from '../layout'
import { H1, H2 } from '@/components/Text'

export default function CreateSpacePage (): JSX.Element {
  return (
    <>
      <SpacesNav />
      <H1>Create a new Space</H1>
      <div className='border border-hot-red rounded-2xl bg-white p-5 max-w-4xl'>
        <SpaceCreatorForm className='mb-8' />
        <H2>Explain</H2>
        <p className='font-epilogue'>
          A space is a decentralized bucket. The name you give it is a memorable alias.
        </p>
        <p className='font-epilogue'>
          It&apos;s true name is a unique DID derived from a key-pair.
        </p>
        <p className="font-epilogue mt-4">
          Console, your agent, creates a UCAN delegating all capabilities on that space to your email DID.
        </p>
        <p className="font-epilogue mt-4">
          You can allow others to use your space, by creating a delegation to their email or a specific agent from the share page.
        </p>
        <p className="font-epilogue mt-4">
          For details on how this works see <a className='underline' href="https://github.com/web3-storage/specs/blob/main/w3-account.md">specs/w3-account</a>
        </p>
      </div>
    </>
  )
}
