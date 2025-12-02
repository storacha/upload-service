# Principal Resolvers

A library of principal resolvers that resolve from one DID to another. Typically `did:web` to `did:key`.

## Install

```bash
npm install @storacha/principal-resolver
```

## Usage

Example:

```js
import * as HTTPResolver from '@storacha/principal-resolver/http'

// create a did:web resolver for DIDs that end with ".storacha.network"
const resolver = HTTPResolver.create([/^did:web:.*\.storacha\.network$/])

const result = await resolver.resolveDIDKey('did:web:up.storacha.network')

console.log(result.ok) // ['did:key:z6MkqdncRZ1wj8zxCTDUQ8CRT8NQWd63T7mZRvZUX8B7XDFi']
```

## License

Dual-licensed under [MIT OR Apache 2.0](https://github.com/storacha/upload-service)
