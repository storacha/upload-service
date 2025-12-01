/**
 * Demo: Space Management Components from @storacha/ui-react
 * 
 * This example demonstrates the new space management components
 * that have been ported from the console application.
 */

import React from 'react'
import {
  Provider,
  SpaceEnsurer,
  SpaceCreator,
  SpaceFinder,
  SpacesList,
  SpacesTabNavigation
} from '@storacha/ui-react'

function SpaceManagementApp() {
  const [activeTab, setActiveTab] = React.useState('public')
  const [selectedSpace, setSelectedSpace] = React.useState(null)
  
  const mockSpaces = [
    { did: () => 'did:key:space1', name: 'My Public Space', access: { type: 'public' } },
    { did: () => 'did:key:space2', name: 'Private Documents', access: { type: 'private' } },
    { did: () => 'did:key:space3', name: 'Development', access: { type: 'public' } },
  ]

  return (
    <Provider 
      connection={/* your connection */}
      servicePrincipal={/* your principal */}
    >
      <SpaceEnsurer
        fallback={
          <div>
            <h2>Create Your First Space</h2>
            <SpaceCreator
              formProps={{
                onSuccess: (space) => console.log('Space created:', space),
                enablePrivateSpaces: true
              }}
            />
          </div>
        }
      >
        <div className="app">
          <h1>Space Management Demo</h1>
          
          <SpacesTabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showPrivateTab={true}
            privateTabLocked={false}
            variant="underline"
          />
          
          <div className="space-finder-section">
            <h3>Find a Space</h3>
            <SpaceFinder
              spaces={mockSpaces}
              selected={selectedSpace}
              onSelect={setSelectedSpace}
              placeholder="Search your spaces..."
              categorizeSpaces={true}
            />
          </div>
          
          <div className="spaces-list-section">
            <h3>{activeTab === 'public' ? 'Public' : 'Private'} Spaces</h3>
            <SpacesList
              spaces={mockSpaces.filter(s => 
                activeTab === 'public' 
                  ? s.access?.type !== 'private'
                  : s.access?.type === 'private'
              )}
              onSelect={(space) => console.log('Selected:', space)}
              onDelete={(space) => console.log('Delete:', space)}
              onRename={(space, newName) => console.log('Rename:', space, newName)}
              showActions={true}
              type={activeTab}
            />
          </div>
          
          <div className="create-space-section">
            <h3>Create New Space</h3>
            <SpaceCreator
              buttonText="Add New Space"
              formProps={{
                onSuccess: (space) => {
                  console.log('Created new space:', space)
                },
                enablePrivateSpaces: true,
                defaultName: 'New Space'
              }}
            />
          </div>
        </div>
      </SpaceEnsurer>
    </Provider>
  )
}

export default SpaceManagementApp

/**
 * Usage in Console App:
 * 
 * 1. Import from @storacha/ui-react instead of local components:
 *    import { SpaceEnsurer, SpaceCreator, ... } from '@storacha/ui-react'
 * 
 * 2. Apply your existing styles via className props:
 *    <SpacesList className="your-existing-styles" ... />
 * 
 * 3. Use custom renderers for complete control:
 *    <SpacesList
 *      renderSpaceItem={(space, handlers) => (
 *        <YourCustomSpaceItem space={space} {...handlers} />
 *      )}
 *    />
 * 
 * 4. All components are fully typed with TypeScript
 * 
 * 5. Components are unstyled by default - bring your own CSS
 */
