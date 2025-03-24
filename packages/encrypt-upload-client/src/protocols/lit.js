import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LIT_ABILITY } from '@lit-protocol/constants'
import {
  generateAuthSig,
  LitActionResource,
  createSiweMessage,
  LitAccessControlConditionResource
} from '@lit-protocol/auth-helpers'

import env from '../config/env.js'
import * as Type from '../types.js'
import { STORACHA_LIT_ACTION_CID } from '../config/constants.js'


export { encryptString } from '@lit-protocol/encryption'

/**
* Create access control conditions required to use Lit Protocol.
* This ensures that the Storacha Lit Action is used to validate decryption permissions for the specified space DID.
* @param {Type.SpaceDID} spaceDID - The DID of the space
* @returns {import('@lit-protocol/types').AccessControlConditions} - The access control conditions
*/
export const getAccessControlConditions = (spaceDID) =>  {
  return  [
      {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':currentActionIpfsId', spaceDID],
      returnValueTest: {
          comparator: '=',
          value: STORACHA_LIT_ACTION_CID
      }
      }
  ]
}

export async function getLitClient() {
  const litNodeClient = new LitNodeClient({
    litNetwork: env.LIT_NETWORK,
    debug: env.LIT_DEBUG
  })

  await litNodeClient.connect()
  return litNodeClient
}

/**
 * @param {LitNodeClient} litClient 
 * @param {Type.SessionSignatureOptions} param0
 * @returns {Promise<import('@lit-protocol/types').SessionSigsMap>}
 */
export async function getSessionSigs(litClient, {
  wallet,
  accessControlConditions,
  dataToEncryptHash,
  expiration,
  capabilityAuthSigs
}) {
  const accsResourceString = await LitAccessControlConditionResource.generateResourceString(
    accessControlConditions,
    dataToEncryptHash
  )

  const sessionSigs = await litClient.getSessionSigs({
    chain: 'ethereum',
    capabilityAuthSigs,
    expiration,
    resourceAbilityRequests: [
      {
        resource: new LitAccessControlConditionResource(accsResourceString),
        ability: LIT_ABILITY.AccessControlConditionDecryption
      },
      {
        resource: new LitActionResource('*'),
        ability: LIT_ABILITY.LitActionExecution
      }
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await createSiweMessage({
        uri,
        expiration,
        resources: resourceAbilityRequests,
        walletAddress: wallet.address,
        nonce: await litClient.getLatestBlockhash(),
        litNodeClient: litClient
      })

      return await generateAuthSig({
        signer: wallet,
        toSign
      })
    }
  })

  return sessionSigs
}

/**
 * 
 * @param {LitNodeClient} litClient  
 * @param {Type.ExecuteUcanValidationOptions} options 
 * @returns 
 */
export const executeUcanValidatoinAction = async (litClient, options) => {
  const {sessionSigs, ...jsParams} = options

  const litActionResponse = await litClient.executeJs({
    ipfsId: STORACHA_LIT_ACTION_CID,
    sessionSigs,
    jsParams 
  })

  if (!litActionResponse.response) {
    throw new Error('Error getting lit action response.')
  }

  const parsedResponse = JSON.parse(/** @type string*/ (litActionResponse.response))
  const decryptedData = parsedResponse.decryptedString

  if (!decryptedData) {
    let errorMsg
    if (parsedResponse.error) errorMsg = parsedResponse.error
    throw new Error(`Decrypted data does not exist! Error message: ${errorMsg}`)
  }

  return decryptedData
}