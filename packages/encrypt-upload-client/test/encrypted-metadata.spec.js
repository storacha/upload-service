import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as Result from '@storacha/client/result'
import * as Types from '../src/types.js'
import { create, extract } from '../src/core/metadata/encrypted-metadata.js'
import { CID } from 'multiformats'

/** @type {Types.LitMetadataInput} */
const encryptedMetadataInput = {
  encryptedDataCID:
    'bafkreids275u5ex6xfw7d4k67afej43c6rhm2kzdox2z6or4jxrndgevae',
  identityBoundCiphertext:
    'mF3OPa9dQ0wO4B1/XylmAV/eaHhLtM3JUPIbS175bvmqGaJUYroyDbsytV29q0cLD4XCpCRfCinntASNg9s730FIM7f4Mw2hVWeJ5g4akFA6BoZoaKgDC5Ln6MOQK5Ymb1y6No7um7Bn4uIIJTYNuUukDQvVxzY8LcRBc2ySR1Md+VSGzmyEgyvHtAI=',
  plaintextKeyHash:
    '15f39e9a977cca43f16f3cd25237d711cd8130ff9763197b29df52a198607206',
  accessControlConditions: [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [
        ':currentActionIpfsId',
        'did:key:z6MktfnQz8Kcz5nsC65oyXWFXhbbAZQavjg6LYuHgv4YbxzN',
      ],
      returnValueTest: {
        comparator: '=',
        value: 'QmPFrQGo5RAtdSTZ4bkaeDHVGrmy2TeEUwTu4LuVAPHiMd',
      },
    },
  ],
}
/** @type {Types.KMSMetadata} */
const kmsMetadataInput = {
  encryptedDataCID: CID.parse(
    'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
  ),
  encryptedSymmetricKey: 'bXlLTVNLZXlCeXRlcw==', // 'myKMSKeyBytes' in base64 for example
  space: 'did:key:z6MktfnQz8Kcz5nsC65oyXWFXhbbAZQavjg6LYuHgv4YbxzN',
  kms: {
    provider: 'google-kms',
    keyId: 'test-key',
    algorithm: 'RSA-OAEP-2048-SHA256',
  },
}

await describe('LitEncrypted Metadata', async () => {
  await it('should create a valid block content', async () => {
    const encryptedMetadata = create('lit', encryptedMetadataInput)
    const block = await encryptedMetadata.archiveBlock()
    // Encode the block into a CAR file
    const car = await import('@ucanto/core').then((m) =>
      m.CAR.encode({ roots: [block] })
    )
    // Use the extract function to get the JSON object
    const extractedData = Result.unwrap(extract(car))
    const extractedDataJson = extractedData.toJSON()

    assert.equal(
      extractedDataJson.identityBoundCiphertext,
      encryptedMetadataInput.identityBoundCiphertext
    )
    assert.equal(
      extractedDataJson.plaintextKeyHash,
      encryptedMetadataInput.plaintextKeyHash
    )
    assert.equal(
      extractedDataJson.encryptedDataCID,
      encryptedMetadataInput.encryptedDataCID
    )
    assert.deepEqual(
      extractedDataJson.accessControlConditions,
      encryptedMetadataInput.accessControlConditions
    )
  })
})

await describe('KMS Encrypted Metadata', async () => {
  await it('should create a valid block content', async () => {
    const kmsMetadata = create('kms', kmsMetadataInput)
    const block = await kmsMetadata.archiveBlock()
    const car = await import('@ucanto/core').then((m) =>
      m.CAR.encode({ roots: [block] })
    )
    const extractedData = Result.unwrap(extract(car))
    const extractedDataJson = extractedData.toJSON()

    assert.equal(
      extractedDataJson.encryptedSymmetricKey,
      kmsMetadataInput.encryptedSymmetricKey
    )
    assert.equal(
      extractedDataJson.encryptedDataCID,
      kmsMetadataInput.encryptedDataCID
    )
    assert.equal(extractedDataJson.space, kmsMetadataInput.space)
    assert.deepEqual(extractedDataJson.kms, kmsMetadataInput.kms)
  })
})
