# ucn

User Controlled Names. Mutable references authorized by UCAN, backed by merkle
clocks.

## Background

Check out the [READMOAR.md](./READMOAR.md) and the [blog post](https://medium.com/@storacha/the-only-constant-in-life-is-mutability-938658692223).

## Install 

```sh
npm install @storacha/ucn
```

## Usage

### Create and Publish

```js
import { Name } from '@storacha/ucn'

// create a new name
const name = await Name.create()

console.log('Name:', name.toString())
// e.g. Name: did:key:z6MkoE1Qx89dAWThVPWU4WuGPscA9AsA8Q5paP9GhVuCcTCp

const value = '/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui'
const v0 = await Name.v0(value)

await Name.publish(name, v0)
```

⚠️ You MUST store your revision to Storacha using `revision.archive()` and then
`client.uploadCAR()`. This ensures the history of changes are persisted and
other clients can obtain the current value peer to peer.

### Resolve

The resolve function retrieves the latest revision of a name by sending 
requests to remote peer(s). If no remote peers are specified, then the Storacha
rendezvous peer is used.

```js
import { Name, Agent, Proof, NoValueError } from '@storacha/ucn'

// see "Signing Key and Proof Management" below.
const agent = Agent.parse(privateKey)
const name = Name.parse(agent, nameArchive)

try {
  const { value } = await Name.resolve(name)

  console.log(value)
  // e.g. /ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui
} catch (err) {
  if (err.code === NoValueError.code) {
    console.log(`No value has been published for ${name}`)
  }
  throw err
}
```

### Update

Updating involves creating a new _revision_ from the previous value.

```js
import { Name, Value, Agent, Proof } from '@storacha/ucn'

const agent = await Agent.generate()
const name = await Name.create(agent)

const val0 = '/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui'
const rev0 = await Name.v0(val0)

await Name.publish(name, rev0)

// ...later

const val1 = '/ipfs/bafybeiauyddeo2axgargy56kwxirquxaxso3nobtjtjvoqu552oqciudrm'
const rev1 = await Name.increment(Value.from(name, rev0), val1)

await Name.publish(name, rev1)

// ...much later, when we don't know the previous revision!

const current = await Name.resolve(name)

const val2 = '/ipfs/bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy'
const rev2 = await Name.increment(current, val2)

await Name.publish(name, rev2)
```

⚠️ Always resolve the current value for a name from remotes before publishing.
Incrementing a previous value will not necessarily result in the published value
becoming the current value.

### Grant

Granting authorizes other agents to read and/or update the name. 

```js
import { Name, DID, Proof } from '@storacha/ucn'

const agent = await Agent.generate()
const name = await Name.create(agent)

// agent that should be granted access to update the name
// use `agent.did()` to obtain
const recipient = DID.parse('did:key:z6Mkve9LRa8nvXx6Gj2GXevZFN5zHb476FZLS7o1q7fJThFV')

const proof = await Name.grant(name, recipient, { readOnly: false })

console.log(await Proof.format(proof))
// e.g. mAYIEAL3bDhGiZXJvb3RzgGd2ZXJzaW9uAbcCAXESIPa/Vl+6QuagDVY...
```

Using grant:

```js
import { Agent, Name, Proof } from '@storacha/ucn'

// the private key that corresponds to `did:key:z6Mkve9LRa8nvXx6Gj2GXevZFN5zHb476FZLS7o1q7fJThFV`
const agent = Agent.parse(process.env.UCN_PRIVATE_KEY)
// the grant created by the other party
const proof = await Proof.parse('mAYIEAL3bDhGiZXJvb3RzgGd2ZXJzaW9uAbcCAXESIPa/Vl+6QuagDVY...')
const name = Name.from(agent, [proof])

// ready to use! e.g.
// `const current = await Name.resolve(name)`
```

### Signing Key and Proof Management

The **agent private key** is the key used to sign UCAN invocations to update the
name.

The **proofs** are UCAN delegations from the _name_ to the agent, authorizing it
to read (`clock/head`) and/or mutate (`clock/advance`) the current value.

Both of these items MUST be saved if a revision needs to be created in the
future.

```js
import fs from 'node:fs'
await fs.promises.writeFile('agent.priv', agent.encode())
await fs.promises.writeFile('name.car', await name.archive())

// or

import { Agent, Name } from '@storacha/ucn'
console.log(Agent.format(agent)) // base64 encoded string
console.log(await Name.format(name)) // base64 encoded string
```

Restoring exising credentials:

```js
import fs from 'node:fs'
import { Agent, Name } from '@storacha/ucn'

const agent = Agent.decode(await fs.promises.readFile('agent.priv'))
const name = await Name.extract(agent, await fs.promises.readFile('name.car'))

// or

const agent = Agent.parse(process.env.UCN_PRIVATE_KEY)
const name = await Name.parse(agent, process.env.UCN_NAME_ARCHIVE)
```

### Revision Persistence

Each revision MUST be uploaded to Storacha/IPFS to ensure the history of 
changes are persisted and other clients can obtain the current value peer to
peer.

```js
import { Name } from '@storacha/ucn'
import * as Storage from '@storacha/client'

const current = await Name.resolve(name)

const value = '/ipfs/bafybeiauyddeo2axgargy56kwxirquxaxso3nobtjtjvoqu552oqciudrm'
const revision = await Name.increment(current, value)

const storage = await Storage.create(/* ... */)
await storage.uploadCAR(revision.archive())

await Name.publish(name, revision)
```

## Contributing

Feel free to join in. All welcome. Please [open an issue](https://github.com/storacha/upload-service/issues)!

## License

Dual-licensed under [MIT OR Apache 2.0](https://github.com/storacha/upload-service/blob/main/license.md)
