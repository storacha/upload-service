import { describe, it, assert } from 'vitest'
import { delegate } from '@ucanto/core'
import { generate } from '@ucanto/principal/ed25519'
import * as Proof from '../src/proof.js'

describe('proof', () => {
  it('should roundtrip format/parse', async () => {
    const id = await generate()
    const proof = await delegate({
      issuer: id,
      audience: await generate(),
      capabilities: [{ can: '*', with: id.did() }],
      expiration: Infinity
    })
    const str = await Proof.format(proof)
    const parsed = await Proof.parse(str)
    assert.equal(parsed.issuer.did(), proof.issuer.did())
    assert.equal(parsed.audience.did(), proof.audience.did())
  })
})
