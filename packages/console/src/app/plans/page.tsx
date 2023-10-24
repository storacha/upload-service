import Plans from '@/components/Plans'
export default function PlansComponent () {
  return (
    <div className='flex flex-col items-center'>
      <h1 className='text-4xl'>Plans</h1>
      <div className='w-full overflow-x-scroll'>
        <Plans />
      </div>
    </div>
  )
}