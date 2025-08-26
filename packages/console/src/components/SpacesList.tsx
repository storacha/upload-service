import { Space } from '@storacha/ui-react'
import { DidIcon } from './DidIcon'
import { GlobeAltIcon, LockClosedIcon, FolderPlusIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface SpaceListProps {
  spaces: Space[]
  type: 'public' | 'private'
}

export function SpacesList({ spaces, type }: SpaceListProps) {
  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 md:py-12">
        <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-slate-100 rounded-full flex items-center justify-center">
          <GlobeAltIcon className="w-6 h-6 md:w-8 md:h-8 text-slate-400" />
        </div>
        <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-2">No spaces yet</h3>
        <p className="text-sm md:text-base text-slate-600 mb-4 md:mb-6 px-4">
          Create your first space to start storing and organizing your files.
        </p>
        <Link 
          href="/space/create" 
          className="bg-hot-red text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium hover:bg-red-600 transition-colors inline-flex items-center gap-2 text-sm md:text-base"
        >
          <FolderPlusIcon className="w-4 h-4 md:w-5 md:h-5" />
          Create Space
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 max-w-4xl">
      {spaces.map(space => (
        <SpaceItem key={space.did()} space={space} type={type} />
      ))}
    </div>
  )
}

interface SpaceItemProps {
  space: Space
  type: 'public' | 'private'
}

function truncateDid(did: string): string {
  // For mobile: show did:key:first7...last7
  if (did.startsWith('did:key:')) {
    const keyPart = did.substring(8) // Remove 'did:key:'
    if (keyPart.length > 14) {
      return `did:key:${keyPart.substring(0, 7)}...${keyPart.substring(keyPart.length - 7)}`
    }
  }
  return did
}

function SpaceItem({ space, type }: SpaceItemProps) {
  const TypeIcon = type === 'private' ? LockClosedIcon : GlobeAltIcon
  const did = space.did()
  const truncatedDid = truncateDid(did)
  
  const handleCopyDid = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(did)
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy DID:', err)
    }
  }
  
  return (
    <div className="bg-white rounded-lg card-shadow hover:card-shadow-hover transition-all-smooth p-3 md:p-4 group border border-transparent hover:border-hot-red/20">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <DidIcon did={space.did()} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link 
                href={`/space/${space.did()}`}
                className="font-semibold text-sm md:text-base text-slate-900 hover:text-hot-red transition-colors truncate"
              >
                {space.name || 'Untitled Space'}
              </Link>
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                type === 'private' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                <TypeIcon className="w-3 h-3" />
                <span className="hidden sm:inline text-xs">{type === 'private' ? 'Private' : 'Public'}</span>
              </div>
            </div>
            <button
              onClick={handleCopyDid}
              className="flex-shrink-0 p-1 rounded-md hover:bg-slate-100 transition-colors"
              title="Copy DID"
            >
              <ClipboardDocumentIcon className="w-4 h-4 text-slate-500 hover:text-slate-700" />
            </button>
          </div>
          
          <p className="font-mono text-xs text-slate-600">
            <span className="md:hidden">{truncatedDid}</span>
            <span className="hidden md:inline truncate">{did}</span>
          </p>
        </div>
      </div>
    </div>
  )
} 
