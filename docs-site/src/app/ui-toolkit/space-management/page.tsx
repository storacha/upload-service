import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'
import { PropsTable } from '@/components/PropsTable'
import { Playground } from '@/components/Playground'

export default function SpaceManagementPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Space Management Suite</h1>
        
        <p>
          The Space Management Suite provides components and utilities for managing Web3.Storage spaces. 
          Spaces are isolated storage containers that organize your files and provide access control. 
          This suite handles space creation, switching, and management.
        </p>

        <h2>Understanding Spaces</h2>

        <p>
          In Web3.Storage, spaces are the primary organizational unit for your files:
        </p>

        <ul>
          <li><strong>Isolation:</strong> Each space is isolated from others</li>
          <li><strong>Access Control:</strong> Spaces can be public or private</li>
          <li><strong>Organization:</strong> Group related files together</li>
          <li><strong>Permissions:</strong> Control who can access your content</li>
        </ul>

        <h2>SpaceEnsurer Component</h2>

        <p>
          The <code>SpaceEnsurer</code> component ensures that a space exists and is set as the current space. 
          It's essential for applications that need to guarantee a space is available.
        </p>

        <PropsTable rows={[
          { 
            name: 'children', 
            type: 'ReactNode', 
            description: 'Child components to render when space is ready' 
          },
          { 
            name: 'spaceName', 
            type: 'string', 
            description: 'Name for the space if one needs to be created (optional)' 
          },
          { 
            name: 'onSpaceReady', 
            type: '(space: Space) => void', 
            description: 'Callback when space is ready (optional)' 
          }
        ]} />

        <h3>Basic Usage</h3>

        <Playground initialCode={`import React from 'react'
import { Provider, Authenticator, useW3 } from '@storacha/ui-react'

function SpaceEnsurer({ children, spaceName = 'My App Space' }) {
  const [{ client, spaces }] = useW3()
  const [isReady, setIsReady] = React.useState(false)
  const [currentSpace, setCurrentSpace] = React.useState(null)

  React.useEffect(() => {
    async function ensureSpace() {
      if (!client) return

      try {
        let space = client.currentSpace()
        
        if (!space) {
          // Use existing space or create new one
          const existingSpaces = client.spaces()
          if (existingSpaces.length > 0) {
            space = existingSpaces[0]
          } else {
            space = await client.createSpace(spaceName)
          }
          await client.setCurrentSpace(space.did())
        }
        
        setCurrentSpace(space)
        setIsReady(true)
      } catch (error) {
        console.error('Failed to ensure space:', error)
      }
    }

    ensureSpace()
  }, [client, spaceName])

  if (!isReady) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Setting up space...</p>
      </div>
    )
  }

  return children
}

function App() {
  return (
    <Provider>
      <Authenticator>
        <SpaceEnsurer>
          <div className="p-6">
            <h1>My App</h1>
            <p>Space is ready! You can now upload files.</p>
          </div>
        </SpaceEnsurer>
      </Authenticator>
    </Provider>
  )
}`} />

        <h2>Space Information</h2>

        <p>
          You can access detailed information about the current space:
        </p>

        <Playground initialCode={`import React from 'react'
import { useW3 } from '@storacha/ui-react'

function SpaceInfo() {
  const [{ client, spaces }] = useW3()
  const [spaceInfo, setSpaceInfo] = React.useState(null)

  React.useEffect(() => {
    if (client) {
      const currentSpace = client.currentSpace()
      if (currentSpace) {
        const info = {
          did: currentSpace.did(),
          name: currentSpace.name(),
          meta: currentSpace.meta(),
          isPrivate: currentSpace.meta()?.access?.type === 'private'
        }
        setSpaceInfo(info)
      }
    }
  }, [client])

  if (!spaceInfo) {
    return <div>No space selected</div>
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold mb-2">Current Space</h3>
      <div className="space-y-1 text-sm">
        <p><strong>Name:</strong> {spaceInfo.name}</p>
        <p><strong>DID:</strong> {spaceInfo.did}</p>
        <p><strong>Type:</strong> {spaceInfo.isPrivate ? 'Private' : 'Public'}</p>
        {spaceInfo.meta?.description && (
          <p><strong>Description:</strong> {spaceInfo.meta.description}</p>
        )}
      </div>
    </div>
  )
}`} />

        <h2>Space Switching</h2>

        <p>
          Allow users to switch between different spaces:
        </p>

        <Playground initialCode={`import React from 'react'
import { useW3 } from '@storacha/ui-react'

function SpaceSwitcher() {
  const [{ client, spaces }] = useW3()
  const [currentSpace, setCurrentSpace] = React.useState(null)

  React.useEffect(() => {
    if (client) {
      setCurrentSpace(client.currentSpace())
    }
  }, [client])

  const handleSpaceChange = async (spaceDid) => {
    if (client) {
      try {
        const space = spaces.find(s => s.did() === spaceDid)
        if (space) {
          await client.setCurrentSpace(spaceDid)
          setCurrentSpace(space)
        }
      } catch (error) {
        console.error('Failed to switch space:', error)
      }
    }
  }

  if (spaces.length === 0) {
    return <div>No spaces available</div>
  }

  return (
    <div className="space-y-2">
      <label htmlFor="space-select" className="block text-sm font-medium">
        Select Space:
      </label>
      <select
        id="space-select"
        value={currentSpace?.did() || ''}
        onChange={(e) => handleSpaceChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {spaces.map((space) => (
          <option key={space.did()} value={space.did()}>
            {space.name()} ({space.meta()?.access?.type || 'public'})
          </option>
        ))}
      </select>
    </div>
  )
}`} />

        <h2>Creating New Spaces</h2>

        <p>
          Provide functionality to create new spaces:
        </p>

        <Playground initialCode={`import React, { useState } from 'react'
import { useW3 } from '@storacha/ui-react'

function SpaceCreator() {
  const [{ client }] = useW3()
  const [spaceName, setSpaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)

  const handleCreateSpace = async (e) => {
    e.preventDefault()
    if (!client || !spaceName.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      const newSpace = await client.createSpace(spaceName.trim())
      await client.setCurrentSpace(newSpace.did())
      setSpaceName('')
      // Optionally refresh the spaces list or redirect
    } catch (err) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <form onSubmit={handleCreateSpace} className="space-y-4">
      <div>
        <label htmlFor="space-name" className="block text-sm font-medium mb-1">
          Space Name
        </label>
        <input
          id="space-name"
          type="text"
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          placeholder="Enter space name"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
      <button
        type="submit"
        disabled={isCreating || !spaceName.trim()}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isCreating ? 'Creating...' : 'Create Space'}
      </button>
    </form>
  )
}`} />

        <h2>Space Access Control</h2>

        <p>
          Spaces can be configured as public or private:
        </p>

        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
              Public Spaces
            </h4>
            <ul className="text-green-700 dark:text-green-300 text-sm space-y-1">
              <li>• Files are publicly accessible</li>
              <li>• No encryption required</li>
              <li>• Faster uploads</li>
              <li>• Good for public content</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Private Spaces
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
              <li>• Files are encrypted</li>
              <li>• Access control via keys</li>
              <li>• Secure for sensitive data</li>
              <li>• Requires KMS configuration</li>
            </ul>
          </div>
        </div>

        <h2>Space Management Hook</h2>

        <p>
          Create a custom hook for space management:
        </p>

        <pre><code>{`import { useW3 } from '@storacha/ui-react'
import { useState, useCallback } from 'react'

export function useSpaceManagement() {
  const [{ client, spaces }] = useW3()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const createSpace = useCallback(async (name) => {
    if (!client) throw new Error('Client not available')
    
    setIsLoading(true)
    setError(null)
    
    try {
      const space = await client.createSpace(name)
      await client.setCurrentSpace(space.did())
      return space
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const switchSpace = useCallback(async (spaceDid) => {
    if (!client) throw new Error('Client not available')
    
    setIsLoading(true)
    setError(null)
    
    try {
      await client.setCurrentSpace(spaceDid)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const currentSpace = client?.currentSpace()

  return {
    spaces,
    currentSpace,
    createSpace,
    switchSpace,
    isLoading,
    error
  }
}`}</code></pre>

        <h2>Best Practices</h2>

        <h3>1. Always Ensure a Space</h3>
        <p>
          Use <code>SpaceEnsurer</code> or similar logic to guarantee a space is available before 
          allowing file operations.
        </p>

        <h3>2. Handle Space Creation Errors</h3>
        <p>
          Provide clear error messages when space creation fails and offer retry options.
        </p>

        <h3>3. Show Current Space Context</h3>
        <p>
          Always display which space is currently active to avoid user confusion.
        </p>

        <h3>4. Validate Space Names</h3>
        <p>
          Implement client-side validation for space names before creation.
        </p>

        <h2>Integration with Upload Components</h2>

        <p>
          Space management works seamlessly with upload components:
        </p>

        <pre><code>{`import React from 'react'
import { Provider, Authenticator, Uploader, useW3 } from '@storacha/ui-react'

function App() {
  return (
    <Provider>
      <Authenticator>
        <SpaceEnsurer>
          <div className="p-6">
            <SpaceInfo />
            <SpaceSwitcher />
            <Uploader>
              <Uploader.Form>
                <Uploader.Input />
                <button type="submit">Upload to Current Space</button>
              </Uploader.Form>
            </Uploader>
          </div>
        </SpaceEnsurer>
      </Authenticator>
    </Provider>
  )
}`}</code></pre>

        <h2>Next Steps</h2>

        <p>
          Now that you understand space management, you can:
        </p>

        <ul>
          <li><a href="/ui-toolkit/content-management">Learn about content management</a></li>
          <li><a href="/ui-toolkit/uploader">Explore upload components</a></li>
          <li><a href="/examples">See complete examples</a></li>
        </ul>

        <blockquote>
          <p>
            <strong>Tip:</strong> Spaces are the foundation of Web3.Storage organization. 
            Always ensure users have a space available before attempting file operations.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}
