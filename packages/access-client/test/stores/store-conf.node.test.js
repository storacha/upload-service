import assert from 'assert'
import { top } from '@storacha/capabilities/top'
import { Signer as EdSigner } from '@ucanto/principal/ed25519'
import * as RSASigner from '@ucanto/principal/rsa'
import { AgentData } from '../../src/agent-data.js'
import { StoreConf } from '../../src/stores/store-conf.js'

describe('Conf store', () => {
  it('should create and load data', async () => {
    const data = await AgentData.create({
      principal: await RSASigner.generate({ extractable: false }),
    })

    const store = new StoreConf({ profile: 'test-access-db-' + Date.now() })
    await store.open()
    await store.save(data.export())

    const exportData = await store.load()
    assert(exportData)

    // no accounts or delegations yet
    assert.equal(exportData.spaces.size, 0)
    assert.equal(exportData.delegations.size, 0)

    // default meta
    assert.equal(exportData.meta.name, 'agent')
    assert.equal(exportData.meta.type, 'device')
  })

  it('should create and load extractable ed25519 data', async () => {
    const principal = await EdSigner.generate({ extractable: true })
    const data = await AgentData.create({ principal })

    const store = new StoreConf({ profile: 'test-access-db-' + Date.now() })
    await store.open()
    await store.save(data.export())

    const exportData = await store.load()
    assert(exportData)
    const key = exportData.principal.keys[exportData.principal.id]
    assert(key instanceof Uint8Array)
    assert.equal(exportData.principal.id, principal.did())
  })

  it('should reject non-extractable ed25519 in conf store', async () => {
    const data = await AgentData.create({
      principal: await EdSigner.generate(),
    })

    const store = new StoreConf({ profile: 'test-access-db-' + Date.now() })
    await store.open()
    await assert.rejects(() => store.save(data.export()), {
      message:
        'Conf store cannot persist CryptoKey values. Use an extractable signer for Node/Conf storage.',
    })
  })

  it('should round trip delegations', async () => {
    const store = new StoreConf({ profile: 'test-access-db-' + Date.now() })
    await store.open()

    const data0 = await AgentData.create({
      principal: await EdSigner.generate({ extractable: true }),
    })
    const signer = await EdSigner.generate()
    const del0 = await top.delegate({
      issuer: signer,
      audience: data0.principal,
      with: signer.did(),
      expiration: Infinity,
    })

    await data0.addDelegation(del0, {
      audience: { name: 'test', type: 'device' },
    })
    await store.save(data0.export())

    const exportData1 = await store.load()
    assert(exportData1)

    const data1 = AgentData.fromExport(exportData1)

    const { delegation: del1 } =
      data1.delegations.get(del0.cid.toString()) ?? {}
    assert(del1)
    assert.equal(del1.cid.toString(), del0.cid.toString())
    assert.equal(del1.issuer.did(), del0.issuer.did())
    assert.equal(del1.audience.did(), del0.audience.did())
    assert.equal(del1.capabilities[0].can, del0.capabilities[0].can)
    assert.equal(del1.capabilities[0].with, del0.capabilities[0].with)
  })

  it('should be resettable', async () => {
    const principal = await RSASigner.generate({ extractable: false })
    const data = await AgentData.create({ principal })

    const store = new StoreConf({ profile: 'test-access-db-' + Date.now() })
    await store.open()
    await store.save(data.export())

    const exportData = await store.load()
    assert.equal(exportData?.principal.id, principal.did())

    await store.reset()
    const resetExportData = await store.load()
    assert.equal(resetExportData?.principal.id, undefined)
  })
})
