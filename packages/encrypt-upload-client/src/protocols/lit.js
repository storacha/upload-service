import { LitAccessControlConditionResource } from '@lit-protocol/auth-helpers'
import { createAccBuilder } from '@lit-protocol/access-control-conditions'

import * as Type from '../types.js'
import { STORACHA_LIT_ACTION_CID } from '../config/constants.js'

/**
 * Create access control conditions required to use Lit Protocol.
 * This ensures that the Storacha Lit Action is used to validate decryption permissions for the specified space DID.
 *
 * @param {Type.SpaceDID} spaceDID - The DID of the space
 * @returns {import('@lit-protocol/access-control-conditions').AccessControlConditions} - The access control conditions
 */
export const getAccessControlConditions = (spaceDID) => {
  /** @type {import('@lit-protocol/access-control-conditions').UnifiedAccessControlCondition} */
  const rawAcc = {
    conditionType: 'evmBasic',
    contractAddress: '',
    standardContractType: '',
    chain: 'ethereum',
    method: '',
    parameters: [':currentActionIpfsId', spaceDID],
    returnValueTest: {
      comparator: '=',
      value: STORACHA_LIT_ACTION_CID,
    },
  }

  const acc = createAccBuilder().unifiedAccs(rawAcc).build()

  console.log('Access Control Conditions:\n', acc)

  return acc
}

/**
 * @param {import('@lit-protocol/lit-client').LitClientType} litClient
 * @param {Type.AuthManager} authManager - The Lit Auth Manager instance
 * @param {Type.EoaAuthContextOptions} param0
 * @returns {Promise<Type.EoaAuthContext>}
 */
export async function createEoaAuthContext(
  litClient,
  authManager,
  {
    wallet,
    accessControlConditions,
    expiration,
    dataToEncryptHash,
    capabilityAuthSigs,
  }
) {
  const accsResourceString =
    await LitAccessControlConditionResource.generateResourceString(
      /** @type {import('@lit-protocol/types').AccessControlConditions} */ (
        accessControlConditions
      ),
      dataToEncryptHash
    )

  const authContext = await authManager.createEoaAuthContext({
    config: {
      account: wallet,
    },
    authConfig: {
      expiration,
      resources: [
        ['access-control-condition-decryption', accsResourceString], // or '*'
        ['lit-action-execution', '*'],
      ],
      capabilityAuthSigs,
      statement: 'I authorize the Lit Protocol to execute this Lit Action.',
    },
    litClient,
  })

  return authContext
}

/**
 * Get PKP Auth Context.
 *
 * @param {import('@lit-protocol/lit-client').LitClientType} litClient
 * @param {Type.AuthManager} authManager - The Lit Auth Manager instance
 * @param {Type.PkpAuthContextOptions} options
 * @returns {Promise<Type.PkpAuthContext>}
 */
export async function createPkpAuthContext(
  litClient,
  authManager,
  {
    pkpPublicKey,
    authData,
    accessControlConditions,
    dataToEncryptHash,
    expiration,
    capabilityAuthSigs,
  }
) {
  const accsResourceString =
    await LitAccessControlConditionResource.generateResourceString(
      /** @type {import('@lit-protocol/types').AccessControlConditions} */ (
        accessControlConditions
      ),
      dataToEncryptHash
    )

  const authContext = await authManager.createPkpAuthContext({
    authData,
    pkpPublicKey,
    authConfig: {
      resources: [
        ['pkp-signing', '*'], // remove it?
        ['access-control-condition-decryption', accsResourceString], // or '*'
        ['lit-action-execution', '*'],
      ],
      capabilityAuthSigs,
      expiration,
      statement: 'I authorize the Lit Protocol to execute this Lit Action.',
    },
    litClient: litClient,
  })

  return authContext
}

/**
 *
 * @param {import('@lit-protocol/lit-client').LitClientType} litClient
 * @param {Type.ExecuteUcanValidationActionOptions} options
 * @returns
 */
export const executeUcanValidationAction = async (litClient, options) => {
  const { authContext, ...jsParams } = options

  const litActionResponse = await litClient.executeJs({
    ipfsId: STORACHA_LIT_ACTION_CID,
    authContext,
    jsParams,
  })

  console.log('Lit Action Response: \n')
  console.log(litActionResponse)

  if (!litActionResponse.response) {
    throw new Error('Error getting lit action response.')
  }

  const parsedResponse = JSON.parse(
    /** @type string*/ (litActionResponse.response)
  )
  const decryptedData = parsedResponse.decryptedString

  if (!decryptedData) {
    if (parsedResponse.error) {
      throw new Error(`Decryption failed: ${parsedResponse.error}`)
    }

    if (parsedResponse.validateAccess) {
      const parsedValidateAccess = JSON.parse(
        /** @type string*/ (parsedResponse.validateAccess)
      )
      if (parsedValidateAccess.error) {
        throw new Error(
          `Access validation failed: ${
            parsedValidateAccess.error.message ||
            JSON.stringify(parsedValidateAccess.error)
          }`
        )
      }
    }

    throw new Error(
      `Decryption failed: No decrypted data in response despite successful validation`
    )
  }

  return decryptedData
}
