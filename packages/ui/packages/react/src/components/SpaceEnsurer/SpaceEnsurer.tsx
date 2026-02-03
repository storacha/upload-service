import { ReactNode, useEffect, useState } from 'react'
import { useW3 } from '../../providers/Provider.js'
import { Space } from '@storacha/ui-core'

export interface SpaceEnsurerProps {
  children: ReactNode
  fallback?: ReactNode
  createIfMissing?: boolean
  defaultSpaceName?: string
  onSpaceCreated?: (space: Space) => void
  onSpaceSelected?: (space: Space) => void
  className?: string
  loadingComponent?: ReactNode
}

export function SpaceEnsurer({
  children,
  fallback,
  createIfMissing = false,
  defaultSpaceName = 'default space',
  onSpaceCreated,
  onSpaceSelected,
  className,
  loadingComponent
}: SpaceEnsurerProps): ReactNode {
  const [{ client, spaces }] = useW3()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function ensureSpace(): Promise<void> {
      if (!client || spaces.length > 0 || !createIfMissing || isCreating) {
        return
      }

      setIsCreating(true)
      setError(null)

      try {
        let space = client.currentSpace()
        
        if (!space) {
          if (client.spaces().length > 0) {
            space = client.spaces()[0]
            await client.setCurrentSpace(space.did())
          } else {
            const newSpace = await client.createSpace(defaultSpaceName)
            if (newSpace) {
              space = newSpace as unknown as Space
              await client.setCurrentSpace(newSpace.did())
              
              if (onSpaceCreated) {
                onSpaceCreated(space)
              }
            }
          }
        }

        if (space && onSpaceSelected) {
          onSpaceSelected(space)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to ensure space'))
        console.error('Failed to ensure space:', err)
      } finally {
        setIsCreating(false)
      }
    }

    void ensureSpace()
  }, [client, spaces.length, createIfMissing, defaultSpaceName, isCreating, onSpaceCreated, onSpaceSelected])

  if (!client || isCreating) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }
    return (
      <div className={className}>
        <div>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <div className="error">
          Error: {error.message}
        </div>
      </div>
    )
  }

  if (spaces && spaces.length > 0) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <div className={className}>
      <div>
        <p>No spaces found. Please create a space to continue.</p>
      </div>
    </div>
  )
}
