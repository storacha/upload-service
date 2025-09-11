# @storacha/did-plc

Universal utilities for working with the **`did:plc`** method (Node & browser).

## Features

- Resolve a `did:plc` to its DID-Document via the public PLC directory.
- `PlcClient.verifyOwnership` – verify that an arbitrary message was signed by the **current owner** of a `did:plc`.
- `parseDidPlc` – lightweight validator / canonicaliser for `did:plc` strings.
- Works everywhere (`fetch` polyfilled for Node, WebCrypto for signature checks).

## Install

```bash
pnpm add @storacha/did-plc
```

## API

### `PlcClient`

```ts
import { PlcClient } from '@storacha/did-plc'

const client = new PlcClient() // optionally: new PlcClient({ directoryUrl })
const doc = await client.getDocument('did:plc:ewvi7nxzyoun6zhxrhs64oiz')
```

#### `verifyOwnership(did, message, signature)`

```ts
const ok = await client.verifyOwnership(
  'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
  'hello world',
  'BASE64URL_SIGNATURE' // Ed25519, base64url string
)
```

Returns `true` if **any** verificationMethod in the current DID-Document validates the signature.

### `parseDidPlc(input)`

```ts
import { parseDidPlc } from '@storacha/did-plc'

const did = parseDidPlc(' DID:PLC:EWVI7NXZYOUN6ZHXRHS64OIZ  ')
// => 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
```

Throws if the string is not a valid `did:plc`.

## Examples

```ts
import { PlcClient, parseDidPlc } from '@storacha/did-plc'

const client = new PlcClient()
const did = parseDidPlc('did:plc:ewvi7nxzyoun6zhxrhs64oiz')
const doc = await client.getDocument(did)

// ownership proof (base64url Ed25519 signature)
const ok = await client.verifyOwnership(did, 'hello world', signatureB64Url)
```

---

MIT OR Apache-2.0

## References

- [did-method-plc](https://github.com/did-method-plc/did-method-plc/tree/main)
- [storacha/bluesky-backup-webapp-server plc.ts](https://github.com/storacha/bluesky-backup-webapp-server/blob/main/src/lib/plc.ts)
