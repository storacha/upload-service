'use client'

import PricingTable from '@/components/PricingTable'

export default function Plans () {
  return (
    <div className='py-8 flex flex-col items-center'>
      <h1 className='text-2xl font-mono mb-8 font-bold'>Plans</h1>
      <p className='mb-4'>Pick the price plan that works for you.</p>
      <p><b>Starter</b> is <u>free</u> for up to 5GiB.</p>
      <p><b>Lite</b> and <b>Business</b> plans unlock lower cost per GiB.</p>
      <div className='w-full overflow-x-scroll'>
        <PricingTable />
      </div>
    </div>
  )
}
