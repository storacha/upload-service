import { ReactNode, useState, Fragment } from 'react'
import { Space } from '@storacha/ui-core'

export interface SpaceFinderProps {
  spaces: Space[]
  selected?: Space
  onSelect?: (space: Space) => void
  className?: string
  placeholder?: string
  categorizeSpaces?: boolean
  renderSpaceItem?: (space: Space, isSelected: boolean) => ReactNode
  renderNoResults?: (query: string) => ReactNode
  formatSpaceName?: (space: Space) => string
  enableKeyboardNav?: boolean
  maxResults?: number
}

export function SpaceFinder({
  spaces,
  selected,
  onSelect,
  className = '',
  placeholder = 'Search spaces...',
  categorizeSpaces = false,
  renderSpaceItem,
  renderNoResults,
  formatSpaceName,
  enableKeyboardNav = true,
  maxResults
}: SpaceFinderProps): ReactNode {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const getSpaceName = formatSpaceName || ((space: Space) => 
    space.name || space.did()
  )

  const filteredSpaces = query === ''
    ? spaces
    : spaces.filter((space: Space) =>
        getSpaceName(space)
          .toLowerCase()
          .replace(/\s+/g, '')
          .includes(query.toLowerCase().replace(/\s+/g, ''))
      )

  const displaySpaces = maxResults 
    ? filteredSpaces.slice(0, maxResults)
    : filteredSpaces

  const publicSpaces = categorizeSpaces
    ? displaySpaces.filter(space => space.access?.type !== 'private')
    : []
  
  const privateSpaces = categorizeSpaces
    ? displaySpaces.filter(space => space.access?.type === 'private')
    : []

  const hasResults = displaySpaces.length > 0

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!enableKeyboardNav || !isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => 
          prev < displaySpaces.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (displaySpaces[highlightedIndex]) {
          handleSelect(displaySpaces[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (space: Space) => {
    if (onSelect) {
      onSelect(space)
    }
    setIsOpen(false)
    setQuery('')
    setHighlightedIndex(0)
  }

  const renderDefaultSpaceItem = (space: Space, isSelected: boolean, isHighlighted: boolean) => {
    const isPrivate = space.access?.type === 'private'
    
    return (
      <div
        className={`space-item ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
        onClick={() => handleSelect(space)}
      >
        {isPrivate && <span className="private-indicator">🔒</span>}
        <span className="space-name">{getSpaceName(space)}</span>
        {isSelected && <span className="selected-indicator">✓</span>}
      </div>
    )
  }

  const renderDefaultNoResults = (query: string) => (
    <div className="no-results">
      No spaces found matching "{query}"
    </div>
  )

  return (
    <div className={`space-finder ${className}`}>
      <div className="space-finder-input-wrapper">
        <input
          type="text"
          className="space-finder-input"
          placeholder={placeholder}
          value={selected ? getSpaceName(selected) : query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="space-finder-toggle"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          ▼
        </button>
      </div>

      {isOpen && (
        <div className="space-finder-dropdown">
          {!hasResults && query !== '' ? (
            renderNoResults ? renderNoResults(query) : renderDefaultNoResults(query)
          ) : (
            <>
              {categorizeSpaces ? (
                <>
                  {publicSpaces.length > 0 && (
                    <div className="space-category">
                      <div className="space-category-header">
                        <span>🌐 Public Spaces</span>
                      </div>
                      {publicSpaces.map((space, index) => (
                        <Fragment key={space.did()}>
                          {renderSpaceItem 
                            ? renderSpaceItem(space, space.did() === selected?.did())
                            : renderDefaultSpaceItem(
                                space, 
                                space.did() === selected?.did(),
                                index === highlightedIndex
                              )
                          }
                        </Fragment>
                      ))}
                    </div>
                  )}
                  
                  {privateSpaces.length > 0 && (
                    <div className="space-category">
                      <div className="space-category-header">
                        <span>🔒 Private Spaces</span>
                      </div>
                      {privateSpaces.map((space, index) => (
                        <Fragment key={space.did()}>
                          {renderSpaceItem 
                            ? renderSpaceItem(space, space.did() === selected?.did())
                            : renderDefaultSpaceItem(
                                space, 
                                space.did() === selected?.did(),
                                publicSpaces.length + index === highlightedIndex
                              )
                          }
                        </Fragment>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                displaySpaces.map((space, index) => (
                  <Fragment key={space.did()}>
                    {renderSpaceItem 
                      ? renderSpaceItem(space, space.did() === selected?.did())
                      : renderDefaultSpaceItem(
                          space, 
                          space.did() === selected?.did(),
                          index === highlightedIndex
                        )
                    }
                  </Fragment>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
