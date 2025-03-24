import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as Result from '@storacha/client/result'

import * as Types from '../src/types.js'
import { create, extract } from '../src/core/encrypted-metadata.js'

/** @type {Types.EncryptedMetadataInput} */
const encryptedMetadataInput = {
  encryptedDataCID: 'bafkreids275u5ex6xfw7d4k67afej43c6rhm2kzdox2z6or4jxrndgevae',
  identityBoundCiphertext:
    'mF3OPa9dQ0wO4B1/XylmAV/eaHhLtM3JUPIbS175bvmqGaJUYroyDbsytV29q0cLD4XCpCRfCinntASNg9s730FIM7f4Mw2hVWeJ5g4akFA6BoZoaKgDC5Ln6MOQK5Ymb1y6No7um7Bn4uIIJTYNuUukDQvVxzY8LcRBc2ySR1Md+VSGzmyEgyvHtAI=',
  plaintextKeyHash: '15f39e9a977cca43f16f3cd25237d711cd8130ff9763197b29df52a198607206',
  accessControlConditions: [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [
        ':currentActionIpfsId',
        'did:key:z6MktfnQz8Kcz5nsC65oyXWFXhbbAZQavjg6LYuHgv4YbxzN'
      ],
      returnValueTest: {
        comparator: '=',
        value: 'QmPFrQGo5RAtdSTZ4bkaeDHVGrmy2TeEUwTu4LuVAPHiMd'
      }
    }
  ]
}

describe('Encrypted Metadata', () => {
  it('should create a valid CAR', async () => {
    const encryptedMetadata = create(encryptedMetadataInput)
    const result = await encryptedMetadata.archive()
    const car = Result.unwrap(result)

    const extractedData = Result.unwrap((extract(car)))

    const extractedDataJson = extractedData.toJSON()

    assert.equal(extractedDataJson.identityBoundCiphertext, encryptedMetadataInput.identityBoundCiphertext)
    assert.equal(extractedDataJson.plaintextKeyHash, encryptedMetadataInput.plaintextKeyHash)
    assert.equal(extractedDataJson.encryptedDataCID, encryptedMetadataInput.encryptedDataCID)
    assert.deepEqual(extractedData.accessControlConditions, encryptedMetadataInput.accessControlConditions)
  })
})
