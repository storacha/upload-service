// Example: Component-level imports for tree-shaking
import React from 'react'

// Tree-shakeable component imports
import { Authenticator } from '@storacha/ui/react/components/Authenticator'
import { Uploader } from '@storacha/ui/react/components/Uploader'

// Alternative: Direct package imports
// import { Authenticator } from '@storacha/ui-react/components/Authenticator'
// import { Uploader } from '@storacha/ui-react/components/Uploader'

// Core utilities only (framework-agnostic)
import { useAuthenticator } from '@storacha/ui-core'

export function ComponentImportsExample() {
  const auth = useAuthenticator()

  return (
    <div className="space-y-storacha-md">
      <h1 className="text-storacha-foreground">Component-Level Imports Example</h1>
      
      {/* Only import what you need */}
      <Authenticator />
      <Uploader />
      
      <div className="storacha-button">
        Auth Status: {auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
    </div>
  )
}