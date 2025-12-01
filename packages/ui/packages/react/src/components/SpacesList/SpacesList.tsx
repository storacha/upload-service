import { ReactNode } from 'react'
import { Space } from '@storacha/ui-core'

export interface SpacesListProps {
  spaces: Space[]
  onSelect?: (space: Space) => void
  onDelete?: (space: Space) => void
  onRename?: (space: Space, newName: string) => void
  showActions?: boolean
  type?: 'public' | 'private' | 'all'
  className?: string
  emptyStateComponent?: ReactNode
  renderSpaceItem?: (space: Space, handlers: {
    onSelect?: () => void
    onDelete?: () => void
    onRename?: (newName: string) => void
  }) => ReactNode
  enableSorting?: boolean
  sortFunction?: (a: Space, b: Space) => number
  maxItems?: number
  enableVirtualization?: boolean
  itemHeight?: number
  isLoading?: boolean
  loadingComponent?: ReactNode
}

export function SpacesList({
  spaces,
  onSelect,
  onDelete,
  onRename,
  showActions = true,
  type = 'all',
  className = '',
  emptyStateComponent,
  renderSpaceItem,
  enableSorting = true,
  sortFunction,
  maxItems,
  enableVirtualization = false,
  itemHeight = 80,
  isLoading = false,
  loadingComponent
}: SpacesListProps): ReactNode {
  const filteredSpaces = type === 'all' 
    ? spaces
    : spaces.filter(space => {
        const isPrivate = space.access?.type === 'private'
        return type === 'private' ? isPrivate : !isPrivate
      })

  const sortedSpaces = enableSorting
    ? [...filteredSpaces].sort(sortFunction || ((a, b) => {
        const nameA = (a.name || a.did()).toLowerCase()
        const nameB = (b.name || b.did()).toLowerCase()
        return nameA.localeCompare(nameB)
      }))
    : filteredSpaces

  const displaySpaces = maxItems 
    ? sortedSpaces.slice(0, maxItems)
    : sortedSpaces

  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }
    return (
      <div className={`spaces-list loading ${className}`}>
        <div>Loading spaces...</div>
      </div>
    )
  }

  if (displaySpaces.length === 0) {
    if (emptyStateComponent) {
      return <>{emptyStateComponent}</>
    }
    return (
      <div className={`spaces-list empty ${className}`}>
        <p>No {type !== 'all' ? type : ''} spaces found.</p>
        <p>Create your first space to get started.</p>
      </div>
    )
  }

  const defaultRenderSpaceItem = (space: Space) => {
    const isPrivate = space.access?.type === 'private'
    
    return (
      <div 
        className="space-item"
        onClick={() => onSelect && onSelect(space)}
      >
        <div className="space-item-icon">
          {isPrivate ? '🔒' : '🌐'}
        </div>
        <div className="space-item-content">
          <div className="space-item-name">
            {space.name || 'Untitled'}
          </div>
          <div className="space-item-did">
            {space.did()}
          </div>
        </div>
        {showActions && (
          <div className="space-item-actions">
            {onRename && (
              <button
                className="action-rename"
                onClick={(e) => {
                  e.stopPropagation()
                  const newName = prompt('Enter new name:', space.name)
                  if (newName) {
                    onRename(space, newName)
                  }
                }}
              >
                Rename
              </button>
            )}
            {onDelete && (
              <button
                className="action-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete space "${space.name || space.did()}"?`)) {
                    onDelete(space)
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (enableVirtualization && displaySpaces.length > 50) {
    console.warn('Virtualization requested but not implemented. Rendering all items.')
  }

  return (
    <div className={`spaces-list ${className}`}>
      {maxItems && sortedSpaces.length > maxItems && (
        <div className="spaces-list-info">
          Showing {maxItems} of {sortedSpaces.length} spaces
        </div>
      )}
      
      <div className="spaces-list-items">
        {displaySpaces.map((space) => (
          <div key={space.did()} className="spaces-list-item-wrapper">
            {renderSpaceItem 
              ? renderSpaceItem(space, {
                  onSelect: () => onSelect && onSelect(space),
                  onDelete: () => onDelete && onDelete(space),
                  onRename: (newName: string) => onRename && onRename(space, newName)
                })
              : defaultRenderSpaceItem(space)
            }
          </div>
        ))}
      </div>
    </div>
  )
}
