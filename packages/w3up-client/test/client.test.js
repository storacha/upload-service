import assert from 'assert'
import { parseLink } from '@ucanto/server'
import * as Server from '@ucanto/server'
import {
  Agent,
  AgentData,
  claimAccess,
  requestAccess,
} from '@storacha/access/agent'
import { randomBytes, randomCAR } from './helpers/random.js'
import { toCAR } from './helpers/car.js'
import { File } from './helpers/shims.js'
import { authorizeContentServe, Client } from '../src/client.js'
import * as Test from './test.js'
import { receiptsEndpoint } from './helpers/utils.js'
import { Absentee } from '@ucanto/principal'
import { DIDMailto } from '../src/capability/access.js'
import * as Result from './helpers/result.js'
import {
  alice,
  confirmConfirmationUrl,
  gateway,
} from '@storacha/upload-api/test/utils'
import * as SpaceCapability from '@storacha/capabilities/space'
import { getConnection, getContentServeMockService } from './mocks/service.js'
import { gatewayServiceConnection } from '../src/service.js'

/** @type {Test.Suite} */
export const testClient = {
  uploadFile: Test.withContext({
    'should upload a file to the service': async (
      assert,
      { connection, provisionsStorage, uploadTable, registry }
    ) => {
      const bytes = await randomBytes(128)
      const file = new Blob([bytes])
      const expectedCar = await toCAR(bytes)
      /** @type {import('@storacha/upload-client/types').CARLink|undefined} */
      let carCID

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
        receiptsEndpoint: new URL(receiptsEndpoint),
      })

      const space = await alice.createSpace('upload-test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)
      await alice.setCurrentSpace(space.did())

      // Then we setup a billing for this account
      await provisionsStorage.put({
        // @ts-expect-error
        provider: connection.id.did(),
        account: alice.agent.did(),
        consumer: space.did(),
      })

      const dataCID = await alice.uploadFile(file, {
        onShardStored: (meta) => {
          carCID = meta.cid
        },
      })

      assert.deepEqual(await uploadTable.exists(space.did(), dataCID), {
        ok: true,
      })

      Result.try(await registry.find(space.did(), expectedCar.cid.multihash))
      assert.equal(carCID?.toString(), expectedCar.cid.toString())
      assert.equal(dataCID.toString(), expectedCar.roots[0].toString())
    },
    'should not allow upload without a current space': async (
      assert,
      { connection }
    ) => {
      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
      })

      const bytes = await randomBytes(128)
      const file = new Blob([bytes])

      await assert.rejects(alice.uploadFile(file), {
        message:
          'missing current space: use createSpace() or setCurrentSpace()',
      })
    },
  }),
  uploadDirectory: Test.withContext({
    'should upload a directory to the service': async (
      assert,
      { connection, provisionsStorage, uploadTable }
    ) => {
      const bytesList = [await randomBytes(128), await randomBytes(32)]
      const files = bytesList.map(
        (bytes, index) => new File([bytes], `${index}.txt`)
      )

      /** @type {import('@storacha/upload-client/types').CARLink|undefined} */
      let carCID

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
        receiptsEndpoint: new URL(receiptsEndpoint),
      })

      const space = await alice.createSpace('upload-dir-test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)

      await alice.setCurrentSpace(space.did())

      // Then we setup a billing for this account
      await provisionsStorage.put({
        // @ts-expect-error
        provider: connection.id.did(),
        account: alice.agent.did(),
        consumer: space.did(),
      })

      const dataCID = await alice.uploadDirectory(files, {
        onShardStored: (meta) => {
          carCID = meta.cid
        },
      })

      assert.deepEqual(await uploadTable.exists(space.did(), dataCID), {
        ok: true,
      })
      assert.ok(carCID)
      assert.ok(dataCID)
    },
  }),
  uploadCar: Test.withContext({
    'uploads a CAR file to the service': async (
      assert,
      { connection, provisionsStorage, uploadTable, registry }
    ) => {
      const car = await randomCAR(32)

      let carCID = /** @type {import('../src/types.js').CARLink|null} */ (null)

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
        receiptsEndpoint: new URL(receiptsEndpoint),
      })

      const space = await alice.createSpace('car-space', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(await space.createAuthorization(alice))
      await alice.setCurrentSpace(space.did())

      // Then we setup a billing for this account
      await provisionsStorage.put({
        // @ts-expect-error
        provider: connection.id.did(),
        account: alice.agent.did(),
        consumer: space.did(),
      })

      const root = await alice.uploadCAR(car, {
        onShardStored: (meta) => {
          carCID = meta.cid
        },
      })

      assert.deepEqual(await uploadTable.exists(space.did(), root), {
        ok: true,
      })

      if (carCID == null) {
        return assert.ok(carCID)
      }

      Result.try(await registry.find(space.did(), carCID.multihash))
    },
  }),
  getReceipt: Test.withContext({
    'should find a receipt': async (assert, { connection }) => {
      const taskCid = parseLink(
        'bafyreibo6nqtvp67daj7dkmeb5c2n6bg5bunxdmxq3lghtp3pmjtzpzfma'
      )
      const alice = new Client(await AgentData.create(), {
        receiptsEndpoint: new URL('http://localhost:9201'),
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
      })
      const receipt = await alice.getReceipt(taskCid)
      // This is a real `piece/accept` receipt exported as fixture
      assert.ok(receipt)
      assert.ok(receipt?.ran.link().equals(taskCid))
      assert.ok(receipt?.out.ok)
    },
  }),
  currentSpace: {
    'should return undefined or space': async (assert) => {
      const alice = new Client(await AgentData.create())

      const current0 = alice.currentSpace()
      assert.equal(current0, undefined)

      const space = await alice.createSpace('new-space', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(await space.createAuthorization(alice))
      await alice.setCurrentSpace(space.did())

      const current1 = alice.currentSpace()
      assert.ok(current1)
      assert.equal(current1?.did(), space.did())
    },
  },
  spaces: Test.withContext({
    'should get agent spaces': async (assert) => {
      const alice = new Client(await AgentData.create())

      const name = `space-${Date.now()}`
      const space = await alice.createSpace(name, {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)

      const spaces = alice.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].did(), space.did())
      assert.equal(spaces[0].name, name)
      assert.equal(spaces[0].access.type, 'public')
    },

    'should create space with accessType private': async (assert) => {
      const alice = new Client(await AgentData.create())

      const space = await alice.createSpace('private-space', {
        access: {
          type: 'private',
          encryption: {
            provider: 'google-kms',
            algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
          },
        },
        // Creates a temporary space without saving it
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)

      assert.equal(space.access.type, 'private')
      if (space.access.type === 'private') {
        assert.equal(space.access.encryption.provider, 'google-kms')
        assert.equal(
          space.access.encryption.algorithm,
          'RSA_DECRYPT_OAEP_3072_SHA256'
        )
      }

      const spaces = alice.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].access.type, 'private')
      if (spaces[0].access.type === 'private') {
        assert.equal(spaces[0].access.encryption.provider, 'google-kms')
        assert.equal(
          spaces[0].access.encryption.algorithm,
          'RSA_DECRYPT_OAEP_3072_SHA256'
        )
      }
    },

    'should create space with accessType public': async (assert) => {
      const alice = new Client(await AgentData.create())

      const space = await alice.createSpace('public-space', {
        access: { type: 'public' },
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)

      assert.equal(space.access.type, 'public')
      assert.ok(!('encryption' in space.access)) // public spaces have no encryption provider

      const spaces = alice.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].access.type, 'public')
      assert.ok(!('encryption' in spaces[0].access))
    },

    'should default to public accessType when no accessType is provided':
      async (assert) => {
        const alice = new Client(await AgentData.create())

        const space = await alice.createSpace('default-space', {
          skipGatewayAuthorization: true,
        })
        const auth = await space.createAuthorization(alice)
        await alice.addSpace(auth)

        assert.equal(space.access.type, 'public')
        assert.ok(!('encryption' in space.access))

        const spaces = alice.spaces()
        assert.equal(spaces.length, 1)
        assert.equal(spaces[0].access.type, 'public')
        assert.ok(!('encryption' in spaces[0].access))
      },

    'should recover private space from mnemonic preserving accessType': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())

      // Create a private space and get its mnemonic
      const originalSpace = await alice.createSpace('recovery-test-private', {
        access: {
          type: 'private',
          encryption: {
            provider: 'google-kms',
            algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
          },
        },
        skipGatewayAuthorization: true,
      })
      const mnemonic = originalSpace.toMnemonic()

      // Create a new agent/client to simulate recovery
      const bob = new Client(await AgentData.create())

      // Recover the space from mnemonic
      const recoveredSpace = await bob.agent.recoverSpace(mnemonic, {
        name: 'recovered-private-space',
        access: {
          type: 'private',
          encryption: {
            provider: 'google-kms',
            algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
          },
        },
      })

      assert.equal(recoveredSpace.access.type, 'private')
      if (recoveredSpace.access.type === 'private') {
        assert.equal(recoveredSpace.access.encryption.provider, 'google-kms')
        assert.equal(
          recoveredSpace.access.encryption.algorithm,
          'RSA_DECRYPT_OAEP_3072_SHA256'
        )
      }
      assert.equal(recoveredSpace.name, 'recovered-private-space')
      assert.equal(recoveredSpace.did(), originalSpace.did())

      // Add the recovered space and verify accessType is preserved
      const auth = await recoveredSpace.createAuthorization(bob)
      await bob.addSpace(auth)

      const spaces = bob.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].access.type, 'private')
      if (spaces[0].access.type === 'private') {
        assert.equal(spaces[0].access.encryption.provider, 'google-kms')
        assert.equal(
          spaces[0].access.encryption.algorithm,
          'RSA_DECRYPT_OAEP_3072_SHA256'
        )
      }
      assert.equal(spaces[0].name, 'recovered-private-space')
    },

    'should recover public space from mnemonic preserving accessType': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())

      // Create a public space and get its mnemonic
      const originalSpace = await alice.createSpace('recovery-test-public', {
        access: { type: 'public' },
        skipGatewayAuthorization: true,
      })
      const mnemonic = originalSpace.toMnemonic()

      // Create a new agent/client to simulate recovery
      const bob = new Client(await AgentData.create())

      // Recover the space from mnemonic
      const recoveredSpace = await bob.agent.recoverSpace(mnemonic, {
        name: 'recovered-public-space',
        access: { type: 'public' },
      })

      assert.equal(recoveredSpace.access.type, 'public')
      assert.equal(recoveredSpace.name, 'recovered-public-space')
      assert.equal(recoveredSpace.did(), originalSpace.did())

      // Add the recovered space and verify accessType is preserved
      const auth = await recoveredSpace.createAuthorization(bob)
      await bob.addSpace(auth)

      const spaces = bob.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].access.type, 'public')
      assert.equal(spaces[0].name, 'recovered-public-space')
    },

    'should recover space from mnemonic with default accessType': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())

      // Create a space and get its mnemonic
      const originalSpace = await alice.createSpace('recovery-test-default', {
        skipGatewayAuthorization: true,
      })
      const mnemonic = originalSpace.toMnemonic()

      // Create a new agent/client to simulate recovery without specifying accessType
      const bob = new Client(await AgentData.create())

      // Recover the space from mnemonic without accessType (should default to public)
      const recoveredSpace = await bob.agent.recoverSpace(mnemonic, {
        name: 'recovered-default-space',
      })

      assert.equal(recoveredSpace.access.type, 'public')
      assert.equal(recoveredSpace.name, 'recovered-default-space')
      assert.equal(recoveredSpace.did(), originalSpace.did())

      // Add the recovered space and verify accessType defaults to public
      const auth = await recoveredSpace.createAuthorization(bob)
      await bob.addSpace(auth)

      const spaces = bob.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].access.type, 'public')
      assert.equal(spaces[0].name, 'recovered-default-space')
    },

    'should preserve accessType when renaming space with withName': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())

      // Create a private space
      const originalSpace = await alice.createSpace('original-name', {
        access: {
          type: 'private',
          encryption: {
            provider: 'google-kms',
            algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
          },
        },
        skipGatewayAuthorization: true,
      })

      // Create a renamed version of the space
      const renamedSpace = originalSpace.withName('new-name')

      assert.equal(renamedSpace.access.type, 'private')
      if (renamedSpace.access.type === 'private') {
        assert.equal(renamedSpace.access.encryption.provider, 'google-kms')
        assert.equal(
          renamedSpace.access.encryption.algorithm,
          'RSA_DECRYPT_OAEP_3072_SHA256'
        )
      }
      assert.equal(renamedSpace.name, 'new-name')
      assert.equal(renamedSpace.did(), originalSpace.did())

      // Test with public space too
      const publicSpace = await alice.createSpace('public-original', {
        access: { type: 'public' },
        skipGatewayAuthorization: true,
      })

      const renamedPublicSpace = publicSpace.withName('public-renamed')
      assert.equal(renamedPublicSpace.access.type, 'public')
      assert.ok(!('encryption' in renamedPublicSpace.access))
      assert.equal(renamedPublicSpace.name, 'public-renamed')
      assert.equal(renamedPublicSpace.did(), publicSpace.did())
    },

    'should import private space from delegation preserving accessType': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())
      const bob = new Client(await AgentData.create())

      // Alice creates a private space
      const space = await alice.createSpace('delegation-test-private', {
        access: {
          type: 'private',
          encryption: {
            provider: 'google-kms',
            algorithm: 'RSA_DECRYPT_OAEP_3072_SHA256',
          },
        },
        skipGatewayAuthorization: true,
      })

      // Alice creates an authorization for the space with full access
      await alice.addSpace(
        await space.createAuthorization(alice, {
          access: { '*': {} },
          expiration: Infinity,
        })
      )
      await alice.setCurrentSpace(space.did())

      // Alice creates a delegation for Bob
      const delegation = await alice.createDelegation(bob.agent, ['*'])

      // Bob imports the space from delegation
      await bob.addSpace(delegation)

      const bobSpaces = bob.spaces()
      assert.equal(bobSpaces.length, 1)
      assert.equal(bobSpaces[0].access.type, 'private')
      if (bobSpaces[0].access.type === 'private') {
        assert.equal(bobSpaces[0].access.encryption.provider, 'google-kms')
        assert.equal(
          bobSpaces[0].access.encryption.algorithm,
          'RSA_DECRYPT_OAEP_3072_SHA256'
        )
      }
      assert.equal(bobSpaces[0].did(), space.did())
    },

    'should import public space from delegation preserving accessType': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())
      const bob = new Client(await AgentData.create())

      // Alice creates a public space
      const space = await alice.createSpace('delegation-test-public', {
        access: { type: 'public' },
        skipGatewayAuthorization: true,
      })

      // Alice creates an authorization for the space with full access
      await alice.addSpace(
        await space.createAuthorization(alice, {
          access: { '*': {} },
          expiration: Infinity,
        })
      )
      await alice.setCurrentSpace(space.did())

      // Alice creates a delegation for Bob
      const delegation = await alice.createDelegation(bob.agent, ['*'])

      // Bob imports the space from delegation
      await bob.addSpace(delegation)

      const bobSpaces = bob.spaces()
      assert.equal(bobSpaces.length, 1)
      assert.equal(bobSpaces[0].access.type, 'public')
      assert.ok(!('encryption' in bobSpaces[0].access))
      assert.equal(bobSpaces[0].did(), space.did())
    },

    'should handle delegation from space with missing accessType (backwards compatibility)':
      async (assert) => {
        const alice = new Client(await AgentData.create())
        const bob = new Client(await AgentData.create())

        // Alice creates a space without specifying accessType (defaults to public)
        const space = await alice.createSpace('delegation-test-default', {
          skipGatewayAuthorization: true,
        })

        // Alice creates an authorization for the space with full access
        await alice.addSpace(
          await space.createAuthorization(alice, {
            access: { '*': {} },
            expiration: Infinity,
          })
        )
        await alice.setCurrentSpace(space.did())

        // Alice creates a delegation for Bob
        const delegation = await alice.createDelegation(bob.agent, ['*'])

        // Bob imports the space from delegation
        await bob.addSpace(delegation)

        const bobSpaces = bob.spaces()
        assert.equal(bobSpaces.length, 1)
        assert.equal(bobSpaces[0].access.type, 'public') // Should default to public
        assert.ok(!('encryption' in bobSpaces[0].access))
        assert.equal(bobSpaces[0].did(), space.did())
      },

    'should add space': async () => {
      const alice = new Client(await AgentData.create())
      const bob = new Client(await AgentData.create())

      const space = await alice.createSpace('new-space', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(
        await space.createAuthorization(alice, {
          access: { '*': {} },
          expiration: Infinity,
        })
      )
      await alice.setCurrentSpace(space.did())

      const delegation = await alice.createDelegation(bob.agent, ['*'])

      assert.equal(bob.spaces().length, 0)
      await bob.addSpace(delegation)
      assert.equal(bob.spaces().length, 1)

      const spaces = bob.spaces()
      assert.equal(spaces.length, 1)
      assert.equal(spaces[0].did(), space.did())
    },

    'should create a space with recovery account': async (
      assert,
      { client, mail, connect, grantAccess }
    ) => {
      // Step 1: Create a client for Alice and login
      const aliceEmail = 'alice@web.mail'
      const aliceLogin = client.login(aliceEmail)
      const message = await mail.take()
      assert.deepEqual(message.to, aliceEmail)
      await grantAccess(message)
      const aliceAccount = await aliceLogin

      // Step 2: Alice creates a space with her account as the recovery account
      const space = await client.createSpace('recovery-space-test', {
        account: aliceAccount, // The account is the recovery account
        skipGatewayAuthorization: true,
      })
      assert.ok(space)

      // Step 3: Verify the recovery account by connecting to a new device
      const secondClient = await connect()
      const secondLogin = secondClient.login(aliceEmail)
      const secondMessage = await mail.take()
      assert.deepEqual(secondMessage.to, aliceEmail)
      await grantAccess(secondMessage)
      const aliceAccount2 = await secondLogin
      await secondClient.addSpace(
        await space.createAuthorization(aliceAccount2)
      )
      await secondClient.setCurrentSpace(space.did())

      // Step 4: Verify the space is accessible from the new device
      const spaceInfo = await secondClient.capability.space.info(space.did())
      assert.ok(spaceInfo)
    },

    'should create a space without recovery account and fail access from another device':
      async (assert, { client, mail, connect, grantAccess }) => {
        // Step 1: Create a client for Alice and login
        const aliceEmail = 'alice@web.mail'
        const aliceLogin = client.login(aliceEmail)
        const message = await mail.take()
        assert.deepEqual(message.to, aliceEmail)
        await grantAccess(message)
        await aliceLogin

        // Step 2: Alice creates a space without providing a recovery account
        const space = await client.createSpace('no-recovery-space-test', {
          skipGatewayAuthorization: true,
        })
        assert.ok(space)

        // Step 3: Attempt to access the space from a new device
        const secondClient = await connect()
        const secondLogin = secondClient.login(aliceEmail)
        const secondMessage = await mail.take()
        assert.deepEqual(secondMessage.to, aliceEmail)
        await grantAccess(secondMessage)
        const aliceAccount2 = await secondLogin

        // Step 4: Add the space to the new device and set it as current space
        await secondClient.addSpace(
          await space.createAuthorization(aliceAccount2)
        )
        await secondClient.setCurrentSpace(space.did())

        // Step 5: Verify the space is accessible from the new device
        await assert.rejects(secondClient.capability.space.info(space.did()), {
          message: `no proofs available for resource ${space.did()} and ability space/info`,
        })
      },

    'should fail to create a space due to provisioning error': async (
      assert,
      { client, mail, grantAccess }
    ) => {
      // Step 1: Create a client for Alice and login
      const aliceEmail = 'alice@web.mail'
      const aliceLogin = client.login(aliceEmail)
      const message = await mail.take()
      assert.deepEqual(message.to, aliceEmail)
      await grantAccess(message)
      const aliceAccount = await aliceLogin

      // Step 2: Mock the provisioning to fail
      const originalProvision = aliceAccount.provision
      aliceAccount.provision = async () => ({
        error: { name: 'ProvisionError', message: 'Provisioning failed' },
      })

      // Step 3: Attempt to create a space with the account
      await assert.rejects(
        client.createSpace('provision-fail-space-test', {
          account: aliceAccount,
        }),
        {
          message: 'failed to provision account: Provisioning failed',
        }
      )

      // Restore the original provision method
      aliceAccount.provision = originalProvision
    },

    'should fail to create a space due to delegate access error': async (
      assert,
      { client, mail, connect, grantAccess }
    ) => {
      // Step 1: Create a client for Alice and login
      const aliceEmail = 'alice@web.mail'
      const aliceLogin = client.login(aliceEmail)
      const message = await mail.take()
      assert.deepEqual(message.to, aliceEmail)
      await grantAccess(message)
      const aliceAccount = await aliceLogin

      // Step 2: Mock the delegate access to fail
      const originalDelegate = client.capability.access.delegate
      client.capability.access.delegate = async (...args) => {
        return {
          error: { name: 'DelegateError', message: 'Delegation failed' },
        }
      }

      // Step 3: Attempt to create a space with the account
      // Skip gateway authorization to avoid other potential failures
      let errorCaught = false
      try {
        await client.createSpace('delegate-fail-space-test', {
          account: aliceAccount,
          skipGatewayAuthorization: true,
        })
        console.log('ERROR: Space creation should have failed but succeeded')
      } catch (error) {
        console.log(
          'Error caught as expected:',
          /** @type {Error} */ (error).message
        )
        errorCaught = true
        assert.equal(
          /** @type {Error} */ (error).message,
          'failed to authorize recovery account: Delegation failed'
        )
      }
      assert.ok(errorCaught, 'Expected error was not thrown')

      // Restore the original delegate method
      client.capability.access.delegate = originalDelegate
    },
  }),
  shareSpace: Test.withContext({
    'should share the space with another account': async (
      assert,
      { client: aliceClient, mail, grantAccess, connection }
    ) => {
      // Step 1: Create a client for Alice and login
      const aliceEmail = 'alice@web.mail'
      const aliceLogin = aliceClient.login(aliceEmail)
      const message = await mail.take()
      assert.deepEqual(message.to, aliceEmail)
      await grantAccess(message)
      const aliceAccount = await aliceLogin

      // Step 2: Alice creates a space
      const space = await aliceClient.createSpace('share-space-test', {
        account: aliceAccount,
        skipGatewayAuthorization: true,
      })
      assert.ok(space)

      // Step 3: Alice shares the space with Bob
      const bobEmail = 'bob@web.mail'
      await aliceClient.shareSpace(bobEmail, space.did())

      // Step 4: Bob access his device and his device gets authorized
      const bobAccount = Absentee.from({ id: DIDMailto.fromEmail(bobEmail) })
      const bobAgentData = await AgentData.create()
      const bobClient = await Agent.create(bobAgentData, {
        connection,
      })

      // Authorization
      await requestAccess(bobClient, bobAccount, [{ can: '*' }])
      await confirmConfirmationUrl(bobClient.connection, await mail.take())

      // Step 5: Claim Access to the shared space
      await claimAccess(bobClient, bobClient.issuer.did(), {
        addProofs: true,
      })

      // Step 6: Bob verifies access to the space
      const spaceInfo = await bobClient.getSpaceInfo(space.did())
      assert.ok(spaceInfo)
      assert.equal(spaceInfo.did, space.did())

      // Step 7: The shared space should be part of Bob's spaces
      const spaces = bobClient.spaces
      assert.equal(spaces.size, 1)
      assert.equal(spaces.get(space.did())?.name, space.name)

      // Step 8: Make sure Alice and Bob's clients/devices are different
      assert.notEqual(aliceClient.did(), bobClient.did())
    },

    'should fail to share the space if the delegate call returns an error':
      async (assert, { client, mail, grantAccess }) => {
        // Step 1: Create a client for Alice and login
        const aliceEmail = 'alice@web.mail'
        const aliceLogin = client.login(aliceEmail)
        const message = await mail.take()
        assert.deepEqual(message.to, aliceEmail)
        await grantAccess(message)
        const aliceAccount = await aliceLogin

        // Step 2: Alice creates a space
        const space = await client.createSpace(
          'share-space-delegate-fail-test',
          {
            account: aliceAccount,
            skipGatewayAuthorization: true,
          }
        )
        assert.ok(space)

        // Step 3: Mock the delegate call to return an error
        const originalDelegate = client.capability.access.delegate
        // @ts-ignore
        client.capability.access.delegate = async () => {
          return { error: { message: 'Delegate failed' } }
        }

        // Step 4: Attempt to share the space with Bob and expect failure
        const bobEmail = 'bob@web.mail'
        await assert.rejects(client.shareSpace(bobEmail, space.did()), {
          message: `failed to share space with ${bobEmail}: Delegate failed`,
        })

        // Restore the original delegate method
        client.capability.access.delegate = originalDelegate
      },

    'should reset current space when sharing': async (
      assert,
      { client, mail, grantAccess }
    ) => {
      // Step 1: Create a client for Alice and login
      const aliceEmail = 'alice@web.mail'
      const aliceLogin = client.login(aliceEmail)
      const message = await mail.take()
      assert.deepEqual(message.to, aliceEmail)
      await grantAccess(message)
      const aliceAccount = await aliceLogin

      // Step 2: Alice creates a space
      const spaceA = await client.createSpace('test-space-a', {
        account: aliceAccount,
        skipGatewayAuthorization: true,
      })
      assert.ok(spaceA)

      // Step 3: Alice creates another space to share with a friend
      const spaceB = await client.createSpace('test-space-b', {
        account: aliceAccount,
        skipGatewayAuthorization: true,
      })
      assert.ok(spaceB)

      // Step 4: Alice set the current space to space A and shares the space B with Bob
      await client.setCurrentSpace(spaceA.did())
      await client.shareSpace('bob@web.mail', spaceB.did())

      // Step 5: Check that current space from Alice is still space A
      const currentSpace = client.currentSpace()
      assert.equal(
        currentSpace?.did(),
        spaceA.did(),
        'current space is not space A'
      )
    },
  }),
  authorizeGateway: Test.withContext({
    'should explicitly authorize a gateway to serve content from a space':
      async (assert, { mail, grantAccess, connection }) => {
        // Step 1: Create a client for Alice and login
        const aliceClient = new Client(
          await AgentData.create({
            principal: alice,
          }),
          {
            // @ts-ignore
            serviceConf: {
              access: connection,
              upload: connection,
            },
          }
        )

        const aliceEmail = 'alice@web.mail'
        const aliceLogin = aliceClient.login(aliceEmail)
        const message = await mail.take()
        assert.deepEqual(message.to, aliceEmail)
        await grantAccess(message)
        const aliceAccount = await aliceLogin

        // Step 2: Alice creates a space
        const spaceA = await aliceClient.createSpace(
          'authorize-gateway-space',
          {
            account: aliceAccount,
            skipGatewayAuthorization: true,
          }
        )
        assert.ok(spaceA)

        const gatewayService = getContentServeMockService()
        const gatewayConnection = getConnection(
          gateway,
          gatewayService
        ).connection

        // Step 3: Alice authorizes the gateway to serve content from the space
        const delegationResult = await authorizeContentServe(
          aliceClient,
          spaceA,
          gatewayConnection
        )
        assert.ok(delegationResult.ok)
        const { delegation } = delegationResult.ok

        // Step 4: Find the delegation for the default gateway
        assert.equal(delegation.audience.did(), gateway.did())
        assert.ok(
          delegation.capabilities.some(
            (c) =>
              c.can === SpaceCapability.contentServe.can &&
              c.with === spaceA.did()
          )
        )
      },
    'should automatically authorize a gateway to serve content from a space when the space is created':
      async (assert, { mail, grantAccess, connection }) => {
        // Step 1: Create a client for Alice and login
        const aliceClient = new Client(
          await AgentData.create({
            principal: alice,
          }),
          {
            // @ts-ignore
            serviceConf: {
              access: connection,
              upload: connection,
            },
          }
        )

        const aliceEmail = 'alice@web.mail'
        const aliceLogin = aliceClient.login(aliceEmail)
        const message = await mail.take()
        assert.deepEqual(message.to, aliceEmail)
        await grantAccess(message)
        const aliceAccount = await aliceLogin

        // Step 2: Alice creates a space
        const gatewayService = getContentServeMockService()
        const gatewayConnection = getConnection(
          gateway,
          gatewayService
        ).connection

        try {
          const spaceA = await aliceClient.createSpace(
            'authorize-gateway-space',
            {
              account: aliceAccount,
              authorizeGatewayServices: [gatewayConnection],
            }
          )
          assert.ok(spaceA, 'should create the space')
        } catch (error) {
          assert.fail(error, 'should not throw when creating the space')
        }
      },
    'should authorize the Storacha Gateway Service when no Gateway Services are provided':
      async (assert, { mail, grantAccess, connection }) => {
        // Step 1: Create a client for Alice and login
        const aliceClient = new Client(
          await AgentData.create({
            principal: alice,
          }),
          {
            // @ts-ignore
            serviceConf: {
              access: connection,
              upload: connection,
              gateway: gatewayServiceConnection({
                id: gateway,
                url: new URL('http://localhost:5001'),
              }),
            },
          }
        )

        const aliceEmail = 'alice@web.mail'
        const aliceLogin = aliceClient.login(aliceEmail)
        const message = await mail.take()
        assert.deepEqual(message.to, aliceEmail)
        await grantAccess(message)
        const aliceAccount = await aliceLogin

        const spaceA = await aliceClient.createSpace(
          'authorize-gateway-space',
          {
            account: aliceAccount,
            authorizeGatewayServices: [], // If no Gateway Services are provided, authorize the Storacha Gateway Service
          }
        )
        assert.ok(spaceA, 'should create the space')
      },
    'should throw when content serve service can not process the invocation':
      async (assert, { mail, grantAccess, connection }) => {
        // Step 1: Create a client for Alice and login
        const aliceClient = new Client(
          await AgentData.create({
            principal: alice,
          }),
          {
            // @ts-ignore
            serviceConf: {
              access: connection,
              upload: connection,
            },
          }
        )

        const aliceEmail = 'alice@web.mail'
        const aliceLogin = aliceClient.login(aliceEmail)
        const message = await mail.take()
        assert.deepEqual(message.to, aliceEmail)
        await grantAccess(message)
        const aliceAccount = await aliceLogin

        // Step 2: Alice creates a space
        const gatewayService = getContentServeMockService({
          error: Server.fail(
            'Content serve service can not process the invocation'
          ).error,
        })
        const gatewayConnection = getConnection(
          gateway,
          gatewayService
        ).connection

        try {
          await aliceClient.createSpace('authorize-gateway-space', {
            account: aliceAccount,
            authorizeGatewayServices: [gatewayConnection],
          })
          assert.fail('should not create the space')
        } catch (error) {
          assert.match(
            // @ts-expect-error
            error.message,
            /failed to publish delegation for audience/,
            'should throw when publishing the delegation'
          )
        }
      },
  }),
  proofs: {
    'should get proofs': async (assert) => {
      const alice = new Client(await AgentData.create())
      const bob = new Client(await AgentData.create())

      const space = await alice.createSpace('proof-space', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(await space.createAuthorization(alice))
      await alice.setCurrentSpace(space.did())

      const delegation = await alice.createDelegation(bob.agent, ['store/*'])

      await bob.addProof(delegation)

      const proofs = bob.proofs()
      assert.equal(proofs.length, 1)
      assert.equal(proofs[0].cid.toString(), delegation.cid.toString())
    },
  },
  delegations: {
    'should get delegations': async (assert) => {
      const alice = new Client(await AgentData.create())
      const bob = new Client(await AgentData.create())

      const space = await alice.createSpace('test', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(await space.createAuthorization(alice))
      await alice.setCurrentSpace(space.did())
      const name = `delegation-${Date.now()}`
      const delegation = await alice.createDelegation(
        bob.agent,
        ['upload/*', 'store/*'],
        {
          audienceMeta: { type: 'device', name },
        }
      )

      const delegations = alice.delegations()
      assert.equal(delegations.length, 1)
      assert.equal(delegations[0].cid.toString(), delegation.cid.toString())
      assert.equal(delegations[0].meta()?.audience?.name, name)
    },
  },

  revokeDelegation: Test.withContext({
    'should revoke a delegation by CID': async (assert, { connection }) => {
      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
      })
      const bob = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
      })

      const space = await alice.createSpace('test', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(
        await space.createAuthorization(alice, {
          access: { '*': {} },
        })
      )
      await alice.setCurrentSpace(space.did())
      const name = `delegation-${Date.now()}`
      const delegation = await alice.createDelegation(bob.agent, ['*'], {
        audienceMeta: { type: 'device', name },
      })

      const result = await alice.revokeDelegation(delegation.cid)
      assert.ok(result.ok)
    },

    'should fail to revoke a delegation it does not know about': async (
      assert
    ) => {
      const alice = new Client(await AgentData.create())
      const bob = new Client(await AgentData.create())

      const space = await alice.createSpace('test', {
        skipGatewayAuthorization: true,
      })
      await alice.addSpace(await space.createAuthorization(alice))
      await alice.setCurrentSpace(space.did())
      const name = `delegation-${Date.now()}`
      const delegation = await alice.createDelegation(bob.agent, ['space/*'], {
        audienceMeta: { type: 'device', name },
      })

      const result = await bob.revokeDelegation(delegation.cid)
      assert.ok(result.error, 'revoke succeeded when it should not have')
    },
  }),
  defaultProvider: {
    'should return the connection ID': async (assert) => {
      const alice = new Client(await AgentData.create())
      assert.equal(alice.defaultProvider(), 'did:web:up.storacha.network')
    },
  },

  capability: {
    'should allow typed access to capability specific clients': async () => {
      const client = new Client(await AgentData.create())
      assert.equal(typeof client.capability.access.authorize, 'function')
      assert.equal(typeof client.capability.access.claim, 'function')
      assert.equal(typeof client.capability.space.info, 'function')
      assert.equal(typeof client.capability.blob.add, 'function')
      assert.equal(typeof client.capability.blob.list, 'function')
      assert.equal(typeof client.capability.blob.remove, 'function')
      assert.equal(typeof client.capability.upload.add, 'function')
      assert.equal(typeof client.capability.upload.list, 'function')
      assert.equal(typeof client.capability.upload.remove, 'function')
    },
  },

  remove: Test.withContext({
    'should remove an uploaded file from the service with its shards': async (
      assert,
      { connection, provisionsStorage, uploadTable }
    ) => {
      const bytes = await randomBytes(128)

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
        receiptsEndpoint: new URL(receiptsEndpoint),
      })

      // setup space
      const space = await alice.createSpace('upload-test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)
      await alice.setCurrentSpace(space.did())

      // Then we setup a billing for this account
      await provisionsStorage.put({
        // @ts-expect-error
        provider: connection.id.did(),
        account: alice.agent.did(),
        consumer: space.did(),
      })

      const content = new Blob([bytes])
      const fileLink = await alice.uploadFile(content)

      assert.deepEqual(await uploadTable.exists(space.did(), fileLink), {
        ok: true,
      })

      assert.deepEqual(
        await alice
          .remove(fileLink, { shards: true })
          .then((ok) => ({ ok: {} }))
          .catch((error) => error),
        { ok: {} }
      )

      assert.deepEqual(await uploadTable.exists(space.did(), fileLink), {
        ok: false,
      })
    },

    'should remove an uploaded file from the service without its shards by default':
      async (assert, { connection, provisionsStorage, uploadTable }) => {
        const bytes = await randomBytes(128)

        const alice = new Client(await AgentData.create(), {
          // @ts-ignore
          serviceConf: {
            access: connection,
            upload: connection,
          },
          receiptsEndpoint: new URL(receiptsEndpoint),
        })

        // setup space
        const space = await alice.createSpace('upload-test', {
          skipGatewayAuthorization: true,
        })
        const auth = await space.createAuthorization(alice)
        await alice.addSpace(auth)
        await alice.setCurrentSpace(space.did())

        // Then we setup a billing for this account
        await provisionsStorage.put({
          // @ts-expect-error
          provider: connection.id.did(),
          account: alice.agent.did(),
          consumer: space.did(),
        })

        const content = new Blob([bytes])
        const fileLink = await alice.uploadFile(content)

        assert.deepEqual(await uploadTable.exists(space.did(), fileLink), {
          ok: true,
        })

        assert.deepEqual(
          await alice
            .remove(fileLink)
            .then((ok) => ({ ok: {} }))
            .catch((error) => error),
          { ok: {} }
        )

        assert.deepEqual(await uploadTable.exists(space.did(), fileLink), {
          ok: false,
        })
      },

    'should fail to remove uploaded shards if upload is not found': async (
      assert,
      { connection }
    ) => {
      const bytes = await randomBytes(128)
      const uploadedCar = await toCAR(bytes)
      const contentCID = uploadedCar.roots[0]

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
      })

      // setup space
      const space = await alice.createSpace('upload-test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)
      await alice.setCurrentSpace(space.did())

      await assert.rejects(alice.remove(contentCID, { shards: true }))
    },

    'should not fail to remove if shard is not found': async (
      assert,
      { connection, provisionsStorage, uploadTable }
    ) => {
      const bytesArray = [await randomBytes(128), await randomBytes(128)]

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: {
          access: connection,
          upload: connection,
        },
        receiptsEndpoint: new URL(receiptsEndpoint),
      })

      // setup space
      const space = await alice.createSpace('upload-test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)
      await alice.setCurrentSpace(space.did())

      // Then we setup a billing for this account
      await provisionsStorage.put({
        // @ts-expect-error
        provider: connection.id.did(),
        account: alice.agent.did(),
        consumer: space.did(),
      })

      const content = new Blob(bytesArray)
      const fileLink = await alice.uploadFile(content)

      const upload = await uploadTable.get(space.did(), fileLink)

      const shard = upload.ok?.shards?.[0]
      if (!shard) {
        return assert.ok(shard)
      }

      // delete shard
      assert.ok((await alice.capability.blob.remove(shard.multihash)).ok)

      assert.deepEqual(
        await alice
          .remove(fileLink, { shards: true })
          .then(() => ({ ok: {} }))
          .catch((error) => ({ error })),
        { ok: {} }
      )
    },

    'should not allow remove without a current space': async (assert) => {
      const alice = new Client(await AgentData.create())

      const bytes = await randomBytes(128)
      const uploadedCar = await toCAR(bytes)
      const contentCID = uploadedCar.roots[0]

      await assert.rejects(alice.remove(contentCID, { shards: true }))
    },
  }),
}

Test.test({ Client: testClient })
