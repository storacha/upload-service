import { describe, it } from 'mocha'
import assert from 'assert'
import * as Name from '../src/name.js'
import * as Proof from '../src/proof.js'

describe('proof', () => {
  it('should roundtrip', async () => {
    const name = await Name.create()
    const str = await Proof.format(name.proof)
    const proof = await Proof.parse(str)
    assert.equal(proof.issuer.did(), name.did())
    assert.equal(proof.audience.did(), name.agent.did())
  })
})
