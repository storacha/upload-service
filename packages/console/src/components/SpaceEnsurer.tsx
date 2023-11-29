'use client'

import { useW3 } from '@w3ui/react'
import { SpaceCreatorForm } from './SpaceCreator';
import { Logo } from '@/brand';

export function SpaceEnsurer ({
  children
}: {
  children: JSX.Element | JSX.Element[];
}): JSX.Element | JSX.Element[]{
  const [{ spaces, accounts }] = useW3()
  if (spaces && spaces.length > 0) {
    return children;
  }
  return (
    <div className="flex flex-col justify-center items-center h-screen bg-zinc-950">
      <div className='text-zinc-950 bg-grad rounded-xl shadow-md px-10 pt-8 pb-8'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <h1 className='text-xl font-semibold'>Welcome{accounts[0] ? ` ${accounts[0]?.toEmail()}` : ''}!</h1>
        <p className='my-2'>
          To get started with w3up you&apos;ll need to create a space.
        </p>
        <p className='my-2'>
          Give it a name and hit create!
        </p>
        <SpaceCreatorForm className='mt-4' />
      </div>
    </div>
  );
}
