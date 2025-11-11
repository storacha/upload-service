# @storacha/router

Routing service types and utilities for storacha.network.

## Description

This package provides TypeScript types for the routing service used in Storacha's blob storage system. The routing service is responsible for selecting storage nodes to allocate blobs with and managing replication across multiple storage providers.

## Installation

```bash
npm install @storacha/router
```

## Usage

```typescript
import type { RoutingService, StorageService, Configuration } from '@storacha/router'

// Implement a routing service
const router: RoutingService = {
  async selectStorageProvider(digest, size) {
    // Select a storage provider based on digest and size
    // ...
  },

  async selectReplicationProviders(primary, count, digest, size, options) {
    // Select multiple storage nodes for replication
    // ...
  },

  async configureInvocation(provider, capability, options) {
    // Configure invocation for a storage provider
    // ...
  }
}
```

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/storacha/upload-service)
