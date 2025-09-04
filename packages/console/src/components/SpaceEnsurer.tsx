'use client'

import { useW3 } from '@storacha/ui-react'
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
    <div className="flex flex-col justify-center items-center min-h-screen bg-racha-fire">
      <div className='text-zinc-950 bg-white rounded-2xl border border-hot-red shadow-md px-10 pt-8 pb-8 my-4'>
        <div className='flex flex-row gap-4 mb-8 justify-center'>
          <Logo className='w-36' />
        </div>
        <h1 className='text-xl font-epilogue'>Welcome{accounts[0] ? ` ${accounts[0]?.toEmail()}` : ''}!</h1>
        <p className='my-2 font-epilogue'>
          To get started with Storacha, you&apos;ll need to create a space.
        </p>
        <p className='my-2 font-epilogue'>
          Give it a name and hit create!
        </p>
        <SpaceCreatorForm className='mt-4' />
      </div>
    </div>
  );
}
