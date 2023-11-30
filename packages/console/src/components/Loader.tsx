import { ArrowPathIcon } from '@heroicons/react/20/solid'

export default function DefaultLoader({ className = '' }: { className?: string }) {
  return (
    <ArrowPathIcon className={`animate-spin ${className}`} />
  )
}

export const TopLevelLoader = () => <DefaultLoader className='h-12 w-full mt-12 text-white' />
