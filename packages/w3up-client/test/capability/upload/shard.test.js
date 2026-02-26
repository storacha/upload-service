import { randomCAR } from '../../helpers/random.js'
import * as Test from '../../test.js'

export const UploadShardClient = Test.withContext({
  list: {
    'should list upload shards': async (
      assert,
      { client: alice, service, provisionsStorage, uploadTable }
    ) => {
      const car = await randomCAR(128)

      const space = await alice.createSpace('test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(alice)
      await alice.addSpace(auth)
      await alice.setCurrentSpace(space.did())

      // @ts-expect-error
      await provisionsStorage.put({
        provider: service.did(),
        customer: 'did:mailto:alice@web.mail',
        consumer: space.did(),
      })

      await alice.capability.upload.add(car.roots[0], [car.cid])

      const list = await alice.capability.upload.shard.list(car.roots[0])
      assert.deepEqual(
        list.results.map(r => r.toString()).sort(),
        [car.cid].map(r => r.toString()).sort(),
      )
    },
  },
})

Test.test({ UploadShardClient })
