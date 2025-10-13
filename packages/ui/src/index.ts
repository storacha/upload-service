// Meta-package exports for @storacha/ui
// This provides unified access to all UI packages

// Re-export core utilities
export * from '@storacha/ui-core'

// Re-export React components (conditional)
export * from '@storacha/ui-react'

// Type-only exports for better tree-shaking
export type {
  // React component props (using actual exported type names)
  AuthenticatorRootProps,
  UploaderRootProps,
  AuthenticatorContextState,
  UploaderContextState,
} from '@storacha/ui-react'
