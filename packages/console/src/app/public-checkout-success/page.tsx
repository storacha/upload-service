'use client'

import { Logo } from '@/brand'

export default function PublicCheckoutSuccess() {
  return (
    <div className="py-8 flex flex-col items-center">
      <div className="my-24">
        <Logo />
      </div>
      <div className="border-2 border-hot-red rounded-xl bg-white p-8 flex flex-col items-center text-center gap-8">
        <h1 className="text-2xl font-mono font-bold">Congratulations!</h1>
        <h2 className="text-xl font-mono">
          Your payment was successful. You now can close this window.
        </h2>
      </div>
    </div>
  )
}
