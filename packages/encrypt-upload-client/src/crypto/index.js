// Symmetric crypto implementations (algorithm-specific)
export { BrowserAesCtrCrypto } from './symmetric/browser-aes-ctr-crypto.js'
export { NodeAesCbcCrypto } from './symmetric/node-aes-cbc-crypto.js'

// Strategy adapters (composition-based)
export { LitCryptoAdapter } from './adapters/lit-crypto-adapter.js'
export { KMSCryptoAdapter } from './adapters/kms-crypto-adapter.js'

// Convenience factory functions
export {
  createBrowserLitAdapter,
  createNodeLitAdapter,
  createBrowserKMSAdapter,
  createNodeKMSAdapter,
} from './factories.js'
