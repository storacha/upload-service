import { describe, it, assert, expect } from 'vitest'
import { Schema, DID, isDelegation } from '@ucanto/core'
import * as ed25519 from '@ucanto/principal/ed25519'
import * as ClockCaps from '@web3-storage/clock/capabilities'
import * as Name from '../src/name.js'

describe('name', () => {
  it('should create a new name', async () => {
    const name = await Name.create()
    assert(Schema.did({ method: 'key' }).is(name.did()))
    assert.doesNotThrow(() => DID.parse(name.did()))
    assert.notEqual(name.agent.did(), name.did())

    const payload = new Uint8Array([1, 2, 3])
    const sig = await name.agent.sign(payload)
    assert(await name.agent.verifier.verify(payload, sig))

    const proof = name.proofs[0]
    assert(isDelegation(proof))
    assert.equal(proof.issuer.did(), name.did())
    assert.equal(proof.audience.did(), name.agent.did())
    assert.equal(proof.capabilities[0].can, '*')
    assert.equal(proof.capabilities[0].with, name.did())
    assert.equal(proof.expiration, Infinity)
  })

  it('should create a new name BYO signer', async () => {
    const signer = await ed25519.generate()
    const name = await Name.create(signer)
    assert.equal(name.agent.did(), signer.did())
  })

  it('should return name DID when converted to string', async () => {
    const name = await Name.create()
    assert.equal(name.toString(), name.did())
  })

  it('should grant write access', async () => {
    const receipient = await ed25519.generate()
    const name = await Name.create()
    const proof = await Name.grant(name, receipient.did())
    assert.equal(proof.audience.did(), receipient.did())
    assert(
      proof.capabilities.some((c) =>
        ['*', ClockCaps.clock.can, ClockCaps.advance.can].includes(c.can)
      )
    )
    assert(
      proof.capabilities.some((c) =>
        ['*', ClockCaps.clock.can, ClockCaps.head.can].includes(c.can)
      )
    )
  })

  it('should grant read only access', async () => {
    const receipient = await ed25519.generate()
    const name = await Name.create()
    const proof = await Name.grant(name, receipient.did(), { readOnly: true })
    assert.equal(proof.audience.did(), receipient.did())
    assert(proof.capabilities.some((c) => c.can === ClockCaps.head.can))
    assert(
      !proof.capabilities.some((c) =>
        ['*', ClockCaps.clock.can, ClockCaps.advance.can].includes(c.can)
      )
    )
  })

  it('should fail to grant write access to a read only name', async () => {
    const receipient0 = await ed25519.generate()
    const receipient1 = await ed25519.generate()
    const name0 = await Name.create()
    const proof = await Name.grant(name0, receipient0.did(), { readOnly: true })
    const name1 = Name.from(receipient0, [proof])
    await expect(
      Name.grant(name1, receipient1.did(), { readOnly: false })
    ).rejects.toThrow(/name not writable/)
  })

  it('should fail to instantiate name for agent and proof mismatch', async () => {
    const name0 = await Name.create()
    const name1 = await Name.create()
    assert.throws(
      () => Name.from(name0.agent, name1.proofs, { id: name1.did() }),
      /invalid proof/
    )
  })

  it('should roundtrip archive/extract', async () => {
    const name = await Name.create()
    const bytes = await name.archive()
    const extracted = await Name.extract(name.agent, bytes)
    assert.equal(extracted.did(), name.did())
    for (const p of name.proofs) {
      const proofLink = isDelegation(p) ? p.cid : p
      assert(
        extracted.proofs.some(
          (ep) => String(proofLink) === String(isDelegation(ep) ? ep.cid : ep)
        )
      )
    }
  })

  it('should roundtrip format/parse', async () => {
    const name = await Name.create()
    const str = await Name.format(name)
    const extracted = await Name.parse(name.agent, str)
    assert.equal(extracted.did(), name.did())
    for (const p of name.proofs) {
      const proofLink = isDelegation(p) ? p.cid : p
      assert(
        extracted.proofs.some(
          (ep) => String(proofLink) === String(isDelegation(ep) ? ep.cid : ep)
        )
      )
    }
  })
})
