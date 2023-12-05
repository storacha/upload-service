import { PlusCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline'

export default function ExpandIcon({ open, onToggle }: { open: boolean, onToggle: () => void }) {
  const Component = open ? MinusCircleIcon : PlusCircleIcon
  return (
    <Component
      className='w-9 inline-block align-middle mb-1 px-2 py-0 cursor-pointer hover:text-white'
      title={open ? 'Collapse' : 'Expand'}
      onClick={e => { e.preventDefault(); onToggle() }}
    />
  )
}