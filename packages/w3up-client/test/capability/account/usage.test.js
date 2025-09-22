import * as Test from '../../test.js'
import { receiptsEndpoint } from '../../helpers/utils.js'
import * as Account from '../../../src/account.js'
import * as Result from '../../../src/result.js'

export const UsageClient = Test.withContext({
  report: {
    'should fetch account usage': async (
      assert,
      { client, connection, mail, grantAccess, service }
    ) => {
      const space = await client.createSpace('test', {
        skipGatewayAuthorization: true,
      })
      const auth = await space.createAuthorization(client)
      await client.addSpace(auth)
      await client.setCurrentSpace(space.did())

      const email = 'alice@web.mail'
      const login = Account.login(client, email)
      const message = await mail.take()
      assert.deepEqual(message.to, email)
      await grantAccess(message)
      const account = Result.try(await login)
      await account.save()

      const result = await account.provision(space.did())
      assert.ok(result.ok)

      const content = new Blob(['hello world'])
      await client.uploadFile(content, {
        receiptsEndpoint,
      })

      const period = { from: new Date(0), to: new Date() }

      const usage = await client.capability.account.usage.get(account.did(), {
        period,
      })

      assert.ok(usage.total >= content.size)
      assert.equal(Object.keys(usage.providers).length, 1)
      const providerReport = usage.providers[service.did()]
      assert.ok(providerReport, 'should have usage for provider')
      const record = providerReport.spaces[space.did()]
      assert.ok(record, 'should have usage for space')
      assert.equal(record.provider, connection.id.did())
      assert.equal(record.space, space.did())
      assert.equal(record.period.from, period.from.toISOString())
      assert.ok(record.period.to > period.to.toISOString())
      assert.equal(record.size.initial, 0)
      assert.ok(record.size.final >= content.size)
      assert.ok(record.events.length > 0)
    },
  },
})

Test.test({ UsageClient })
