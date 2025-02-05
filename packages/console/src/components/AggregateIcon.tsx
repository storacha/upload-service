import { RectangleGroupIcon } from '@heroicons/react/24/outline'

export default function AggregateIcon({ className }: { className?: string }) {
  return (
    <RectangleGroupIcon
      className={`w-9 inline-block align-middle mb-1 px-2 py-0 ${className ?? ''}`}
      title='Aggregate'
    />
  )
}