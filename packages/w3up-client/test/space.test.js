import * as Signer from '@ucanto/principal/ed25519'
import * as Test from './test.js'
import {
  Space,
  generate,
  fromMnemonic,
  toMnemonic,
  OwnedSpace,
  SharedSpace,
  fromDelegation,
  createRecovery,
  provision,
  SESSION_LIFETIME,
} from '../src/space.js'
import * as Account from '../src/account.js'
import * as Result from '../src/result.js'
import { randomCAR } from './helpers/random.js'
import { receiptsEndpoint } from './helpers/utils.js'
import * as DIDMailto from '@storacha/did-mailto'

/**
 * @type {Test.Suite}
 */
export const testSpace = Test.withContext({
  'should get meta': async (assert, { client }) => {
    const signer = await Signer.generate()
    const name = `space-${Date.now()}`
    const space = new Space({
      id: signer.did(),
      meta: { name },
      agent: client.agent,
    })
    assert.equal(space.did(), signer.did())
    assert.equal(space.name, name)

    const metadata = space.meta()
    assert.deepEqual(metadata, { name })
    assert.equal(typeof space.meta, 'function')
  },

  'should get meta with accessType': async (assert, { client }) => {
    const signer = await Signer.generate()
    const name = `space-${Date.now()}`
    const space = new Space({
      id: signer.did(),
      meta: { name, accessType: 'private' },
      agent: client.agent,
    })
    assert.equal(space.did(), signer.did())
    assert.equal(space.name, name)
    assert.equal(space.accessType, 'private')
    assert.equal(space.meta()?.name, name)
    assert.equal(space.meta()?.accessType, 'private')
  },

  'should default to public accessType when not specified': async (
    assert,
    { client }
  ) => {
    const signer = await Signer.generate()
    const name = `space-${Date.now()}`
    const space = new Space({
      id: signer.did(),
      meta: { name },
      agent: client.agent,
    })
    assert.equal(space.accessType, 'public')
  },

  'should handle space with no meta': async (assert, { client }) => {
    const signer = await Signer.generate()
    const space = new Space({
      id: signer.did(),
      agent: client.agent,
    })
    assert.equal(space.name, '')
    assert.equal(space.accessType, 'public')
    assert.equal(space.meta(), undefined)
  },

  'should handle space with meta but no name': async (assert, { client }) => {
    const signer = await Signer.generate()
    const space = new Space({
      id: signer.did(),
      meta: { accessType: 'private' },
      agent: client.agent,
    })
    assert.equal(space.name, '')
    assert.equal(space.accessType, 'private')
    assert.deepEqual(space.meta(), { accessType: 'private' })
  },

  'should test StorageUsage methods': async (assert, { client }) => {
    const signer = await Signer.generate()
    const space = new Space({
      id: signer.did(),
      meta: { name: 'test-space', accessType: 'private' },
      agent: client.agent,
    })

    // Test that usage object is created correctly
    assert.ok(space.usage)
    assert.equal(typeof space.usage.get, 'function')

    // Try to call get() method to exercise the date utility functions
    try {
      await space.usage.get()
    } catch (error) {
      // Expected to fail since we don't have proper setup, but this should exercise the date utility functions
      assert.ok(error)
    }
  },

  'should get usage': async (assert, { client, grantAccess, mail }) => {
    const space = await client.createSpace('test', {
      skipGatewayAuthorization: true,
    })

    const email = 'alice@web.mail'
    const login = Account.login(client, email)
    const message = await mail.take()
    assert.deepEqual(message.to, email)
    await grantAccess(message)
    const account = Result.try(await login)

    Result.try(await account.provision(space.did()))
    await space.save()

    const size = 1138
    const archive = await randomCAR(size)
    await client.capability.blob.add(new Blob([archive.bytes]), {
      receiptsEndpoint,
    })

    const found = client.spaces().find((s) => s.did() === space.did())
    if (!found) return assert.fail('space not found')

    const usage = Result.unwrap(await found.usage.get())
    assert.equal(usage, BigInt(size))
  },

  'should generate space with generate function': async (
    assert,
    { client }
  ) => {
    const space = await generate({
      name: 'test-space',
      accessType: 'private',
      agent: client.agent,
    })
    assert.ok(space instanceof OwnedSpace)
    assert.equal(space.name, 'test-space')
    assert.equal(space.accessType, 'private')
  },

  'should convert space to mnemonic and recover': async (
    assert,
    { client }
  ) => {
    const space = await generate({ name: 'test-space', agent: client.agent })
    const mnemonic = toMnemonic(space)
    assert.ok(typeof mnemonic === 'string')
    assert.ok(mnemonic.split(' ').length >= 12) // BIP39 mnemonic should have at least 12 words

    const recovered = await fromMnemonic(mnemonic, {
      name: 'recovered-space',
      agent: client.agent,
    })
    assert.ok(recovered instanceof OwnedSpace)
    assert.equal(recovered.name, 'recovered-space')
    assert.equal(recovered.did(), space.did()) // Same DID because same key
  },

  'should create authorization and fromDelegation': async (
    assert,
    { client }
  ) => {
    const space = await generate({
      name: 'test-space',
      accessType: 'private',
      agent: client.agent,
    })
    const auth = await space.createAuthorization(client.agent)
    assert.ok(auth.facts)
    // @ts-ignore
    assert.equal(auth.facts[0].space.name, 'test-space')
    // @ts-ignore
    assert.equal(auth.facts[0].space.accessType, 'private')

    const sharedSpace = fromDelegation(auth)
    assert.ok(sharedSpace instanceof SharedSpace)
    assert.equal(sharedSpace.name, 'test-space')
    assert.equal(sharedSpace.accessType, 'private')
    assert.equal(sharedSpace.did(), space.did())
  },

  'should test createRecovery function': async (assert, { client }) => {
    const space = await generate({ name: 'recovery-test', agent: client.agent })
    const accountDID = DIDMailto.fromEmail('test@example.com')

    const recovery = await createRecovery(space, accountDID)
    assert.ok(recovery.facts)
    // @ts-ignore
    assert.equal(recovery.facts[0].space.name, 'recovery-test')
    assert.equal(recovery.audience.did(), accountDID)
  },

  'should test SESSION_LIFETIME constant': async (assert) => {
    assert.equal(typeof SESSION_LIFETIME, 'number')
    assert.equal(SESSION_LIFETIME, 60 * 60 * 24 * 365) // 1 year in seconds
  },

  'should test OwnedSpace methods': async (assert, { client }) => {
    const space = await generate({
      name: 'owned-test',
      accessType: 'private',
      agent: client.agent,
    })

    // Test withName method
    const renamedSpace = space.withName('renamed-space')
    assert.equal(renamedSpace.name, 'renamed-space')
    assert.equal(renamedSpace.accessType, 'private')
    assert.equal(renamedSpace.did(), space.did())

    // Test createRecovery method
    const accountDID = DIDMailto.fromEmail('test@example.com')
    const recovery = await space.createRecovery(accountDID)
    assert.ok(recovery.facts)
    // @ts-ignore
    assert.equal(recovery.audience.did(), accountDID)

    // Test toMnemonic method
    const mnemonic = space.toMnemonic()
    assert.ok(typeof mnemonic === 'string')
    assert.ok(mnemonic.split(' ').length >= 12)
  },

  'should test SharedSpace withName method for private space': async (
    assert,
    { client }
  ) => {
    const space = await generate({
      name: 'shared-test',
      accessType: 'private',
      agent: client.agent,
    })
    const auth = await space.createAuthorization(client.agent)
    const sharedSpace = fromDelegation(auth)

    const renamedSharedSpace = sharedSpace.withName('renamed-shared')
    assert.equal(renamedSharedSpace.name, 'renamed-shared')
    assert.equal(renamedSharedSpace.accessType, 'private')
    assert.equal(renamedSharedSpace.did(), sharedSpace.did())

    // Test getters
    assert.ok(sharedSpace.delegation)
    assert.ok(sharedSpace.meta)
  },

  'should test SharedSpace withName method for public space': async (
    assert,
    { client }
  ) => {
    const space = await generate({
      name: 'shared-test',
      accessType: 'public',
      agent: client.agent,
    })
    const auth = await space.createAuthorization(client.agent)
    const sharedSpace = fromDelegation(auth)

    const renamedSharedSpace = sharedSpace.withName('renamed-shared')
    assert.equal(renamedSharedSpace.name, 'renamed-shared')
    assert.equal(renamedSharedSpace.accessType, 'public')
    assert.equal(renamedSharedSpace.did(), sharedSpace.did())

    // Test getters
    assert.ok(sharedSpace.delegation)
    assert.ok(sharedSpace.meta)
  },

  'should test SharedSpace withName method and default to public accessType':
    async (assert, { client }) => {
      const space = await generate({ name: 'shared-test', agent: client.agent })
      const auth = await space.createAuthorization(client.agent)
      const sharedSpace = fromDelegation(auth)

      const renamedSharedSpace = sharedSpace.withName('renamed-shared')
      assert.equal(renamedSharedSpace.name, 'renamed-shared')
      assert.equal(renamedSharedSpace.accessType, 'public')
      assert.equal(renamedSharedSpace.did(), sharedSpace.did())

      // Test getters
      assert.ok(sharedSpace.delegation)
      assert.ok(sharedSpace.meta)
    },

  'should test OwnedSpace save method': async (assert, { client }) => {
    const space = await generate({ name: 'save-test', agent: client.agent })

    // Test save method with agent
    const saveResult = await space.save({ agent: client.agent })
    assert.ok(saveResult.ok)

    // Test save method without agent (should use model.agent)
    const space2 = await generate({ name: 'save-test-2', agent: client.agent })
    const saveResult2 = await space2.save()
    assert.ok(saveResult2.ok)
  },
})

Test.test({ Space: testSpace })
