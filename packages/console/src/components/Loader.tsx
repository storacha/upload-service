import { ArrowPathIcon } from '@heroicons/react/20/solid'

export default function DefaultLoader({ className = '' }: { className?: string }) {
  return (
    <ArrowPathIcon className={`animate-spin ${className}`} />
  )
}

export const TopLevelLoader = () => (
  <div className='min-h-screen flex items-center justify-center'>
    <DefaultLoader className='h-12 w-12 text-black' />
  </div>
)
