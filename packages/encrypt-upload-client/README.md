<h1 align="center">🐔 + 🔑<br/>Encrypt Upload Client</h1>
<p align="center">Use Lit Protocol and Storacha Network to enable private decentralized hot storage.</a></p>

## About

This library leverages @storacha/cli and @lit-protocol/lit-node-client to provide a simple interface for encrypting files with Lit Protocol and uploading them to the Storacha Network. It also enables anyone with a valid space/content/decrypt UCAN delegation to decrypt the file. With Lit Protocol, encryption keys are managed in a decentralized way, so you don't have to handle them yourself.

## Install

You can add the `@storacha/encrypt-upload-client` package to your JavaScript or TypeScript project with `npm`:

```sh
npm @storacha/encrypt-upload-client
```

## Usage

To use this library, you'll need to install `@storacha/cli` and `@lit-protocol/lit-node-client`, as they are required for initialization—though the Lit client is optional. You must also provide a crypto adapter that implements the `CryptoAdapter` interface. A ready-to-use Node.js crypto adapter is already available.

#### CryptoAdapter Interface

```js
interface CryptoAdapter {
  encryptStream(data: BlobLike): EncryptOutput
  decryptStream(encryptedData: ReadableStream, key: Uint8Array, iv: Uint8Array): ReadableStream
}

interface EncryptOutput {
  key: Uint8Array,
  iv: Uint8Array,
  encryptedStream: ReadableStream
}
```

#### Example Usage

```js
const encryptedClient = await EncryptClient.create({
  storachaClient,
  cryptoAdapter: new NodeCryptoAdapter(),
})
```

### Browser Usage

For browser apps, use the `BrowserCryptoAdapter`:

```js
import { BrowserCryptoAdapter } from '@storacha/encrypt-upload-client/dist/crypto-adapters/browser-crypto-adapter.js'

const encryptedClient = await EncryptClient.create({
  storachaClient: client,
  cryptoAdapter: new BrowserCryptoAdapter(),
})
```

### Encryption

The encryption process automatically generates a custom Access Control Condition (ACC) based on the current space setup in your Storacha client. It then creates a symmetric key to encrypt the file and uses Lit Protocol to encrypt that key, so you don't have to manage it yourself. Once encrypted, both the file and the generated encrypted metadata are uploaded to Storacha.

#### Example Usage

```js
const fileContent = await fs.promises.readFile('./README.md')
const blob = new Blob([fileContent])
const cid = await encryptedClient.uploadEncryptedFile(blob)
```

You can find a full example in `examples/encrypt-test.js`.

### Decryption

To decrypt a file, you'll need the CID returned from `uploadEncryptedFile`, a UCAN delegation CAR with the `space/content/decrypt` capability (proving that the file owner has granted you decryption access), and an Ethereum wallet with available Capacity Credits on the Lit Network to cover the decryption cost.

For details on minting Capacity Credits, check out the [official documentation](https://developer.litprotocol.com/concepts/capacity-credits-concept).

#### Example Usage

```js
const decryptedContent = await encryptedClient.retrieveAndDecryptFile(
  wallet,
  cid,
  delegationCarBuffer
)
```

You can find a full example in `examples/decrypt-test.js`.

## Contributing

Feel free to join in. All welcome. Please [open an issue](https://github.com/storacha/upload-service/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/storacha/upload-service/blob/main/license.md)
