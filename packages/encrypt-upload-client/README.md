<h1 align="center">🐔 + 🔑<br/>Encrypt Upload Client</h1>

## About

This library provides client-side encryption and key management solution integrations for files stored on Storacha.

**The library is strategy-agnostic**, meaning it supports different key management solutions without changing your integration code:

- **Lit Protocol** - Decentralized encryption with UCAN-friendly validation inside programmable Lit Actions
- **Google KMS** - Centralized key management for enterprise compliance and auditability

Different apps have different needs: some prioritize decentralization and user sovereignty, while others need to satisfy enterprise compliance or data residency rules. The library unifies the flow so you can switch from a centralized to a decentralized key management solution (or vice versa) without rewriting your entire logic.

**Key features:**

- **Client-side streaming encryption** - memory-efficient for large files
- **Decentralized key management** via Lit Protocol's threshold cryptography network
- **UCAN-based access control** - grant and revoke decrypt permissions without re-encrypting
- **Pluggable crypto adapters** - use Lit Protocol, Google KMS, or implement your own
- **Composable architecture** - integrate seamlessly with existing Storacha workflows

## Install

You can add the `@storacha/encrypt-upload-client` package to your project with `npm`:

```sh
npm install @storacha/encrypt-upload-client
```

## Usage

To use this library, you'll need to install `@storacha/client`. If using the Lit Protocol adapter, you'll also need to install `@lit-protocol/lit-client` and `@lit-protocol/auth`, as they are required for initialization. You must also provide a crypto adapter that implements the `CryptoAdapter` interface.

### CryptoAdapter Interface

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

### Usage

```js
// Using the Lit adapter
const encryptedClient = await create({
  storachaClient: client,
  cryptoAdapter: createGenericLitAdapter(litClient, authManager),
})
```

### Encryption

The encryption process with Lit Adapter automatically generates a custom Access Control Condition (ACC) based on the current space in your Storacha client. It then creates a symmetric key to encrypt the file and uses the Lit Protocol to encrypt that key, so you don't have to manage it yourself. Once encrypted, both the file and the generated encrypted metadata are uploaded to Storacha.

#### Encryption Example

```js
const fileContent = await fs.promises.readFile('./README.md')
const blob = new Blob([fileContent])

const encryptionConfig = {
  issuer: principal,
  spaceDID: space.did(),
}

const cidLink = await encryptedClient.encryptAndUploadFile(
  blob,
  encryptionConfig
)
```

You can find a full example in `examples/encrypt-test.js`.

### Decryption

To decrypt a file, you'll need the CID returned from `encryptAndUploadFile`, a UCAN delegation with the `space/content/decrypt` capability (proving that the file owner has granted you decryption access), and any other parameters specific to the selected adapter.

#### Decryption Example

```js
// Lit adapter using an EOA wallet
const decryptionConfig = {
  wallet,
  decryptDelegation,
  spaceDID,
}

const decryptedContent = await encryptedClient.retrieveAndDecryptFile(
  cid,
  decryptionConfig
)
```

You can find a full example in `examples/decrypt-test.js`.

## Using PKP (Programmable Key Pairs)

If you want to use the Lit Protocol adapter without requiring a wallet (EOA account) for decryption, you can use a PKP (Programmable Key Pair). Check out the [demo code using PKP](https://github.com/storacha/lit-pkp-demo).

## Contributing

Feel free to join in. All welcome. Please [open an issue](https://github.com/storacha/upload-service/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/storacha/upload-service/blob/main/license.md)
