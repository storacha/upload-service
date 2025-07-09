// Symmetric crypto implementations (algorithm-specific)
export { GenericAesCtrStreamingCrypto } from './symmetric/generic-aes-ctr-streaming-crypto.js'
export { NodeAesCbcCrypto } from './symmetric/node-aes-cbc-crypto.js'

// Strategy adapters (composition-based)
export { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
export { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'

// Convenience factory functions
export {
  createCrossEnvLitAdapter as createBrowserLitAdapter,
  createLegacyLitAdapter as createNodeLitAdapter,
  createGenericLitAdapter,
  createGenericKMSAdapter as createBrowserKMSAdapter,
  createNodeKMSAdapter,
  createGenericKMSAdapter,
} from './factories.js'
