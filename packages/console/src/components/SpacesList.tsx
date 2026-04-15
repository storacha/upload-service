import { Space } from '@storacha/ui-react'
import { DidIcon } from './DidIcon'
import Link from 'next/link'
import { ServerStackIcon } from '@heroicons/react/24/outline'

interface SpaceListProps {
  spaces: Space[]
  type: 'public' | 'private'
  showMigrateAll?: boolean
}

export function SpacesList({ spaces, type, showMigrateAll = true }: SpaceListProps) {
  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No {type} spaces yet.</p>
        <Link 
          href="/space/create" 
          className="text-hot-red hover:underline"
        >
          Create your first {type} space
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      {showMigrateAll && spaces.length > 0 && (
        <div className="flex justify-end mb-2">
          <Link
            href="/migrate"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-hot-red hover:bg-hot-yellow-light rounded-lg transition-colors"
            title="Migrate all spaces to Filecoin"
          >
            <ServerStackIcon className="w-4 h-4" />
            Migrate All
          </Link>
        </div>
      )}
      <div className="border rounded-2xl border-hot-red bg-white max-h-[75vh] overflow-y-auto">
        {spaces.map(space => (
          <SpaceItem key={space.did()} space={space} type={type} />
        ))}
      </div>
    </div>
  )
}

interface SpaceItemProps {
  space: Space
  type: 'public' | 'private'
}

function SpaceItem({ space }: SpaceItemProps) {
  return (
    <div className="flex flex-row items-center gap-4 p-4 border-b last:border-0 border-hot-red first:rounded-t-2xl last:rounded-b-2xl hover:bg-hot-yellow-light">
      <Link 
        href={`/space/${space.did()}`} 
        className="flex flex-row items-start gap-4 grow text-left"
      >
        <div className="flex items-center gap-2">
          <DidIcon did={space.did()} />
        </div>
        <div className="grow overflow-hidden whitespace-nowrap text-ellipsis">
          <div className="flex items-center gap-2">
            <span className="font-epilogue text-lg text-hot-red leading-5 m-0">
              {space.name || 'Untitled'}
            </span>
          </div>
          <span className="font-mono text-xs block">
            {space.did()}
          </span>
        </div>
      </Link>
      <Link
        href={`/space/${space.did()}/migrate`}
        className="p-2 text-gray-400 hover:text-hot-red hover:bg-hot-yellow-light rounded-lg transition-colors shrink-0"
        title="Migrate to Filecoin"
        onClick={(e) => e.stopPropagation()}
      >
        <ServerStackIcon className="w-5 h-5" />
      </Link>
    </div>
  )
} 
