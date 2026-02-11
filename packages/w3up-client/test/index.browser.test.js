import * as Test from './test.js'
import { EdDSA } from '@ipld/dag-ucan/signature'
import { create } from '../src/index.js'

/**
 * @type {Test.Suite}
 */
export const testEd25519Key = {
  'should create Ed25519 key': async (assert) => {
    const client = await create()
    const signer = client.agent.issuer
    assert.equal(signer.signatureAlgorithm, 'EdDSA')
    assert.equal(signer.signatureCode, EdDSA)
  },
}

Test.test({ Ed25519: testEd25519Key })
