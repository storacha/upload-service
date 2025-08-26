// Re-export specific items from ui-core
export { 
  Client,
  Account, 
  Space,
  type ContextState,
  type ContextActions,
  type ServiceConfig
} from '@storacha/ui-core'

export * from './providers/Provider.js'
export * from './Authenticator.js'
export * from './Uploader.js'
export * from './hooks.js'
