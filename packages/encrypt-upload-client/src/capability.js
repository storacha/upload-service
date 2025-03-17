import { CID } from 'multiformats'
import * as dagJSON from '@ipld/dag-json'
import { extract } from '@ucanto/core/delegation'
import { Signer } from '@ucanto/principal/ed25519'
import { ok, Schema, DID, fail } from '@ucanto/validator'
import { DID as DIDParser, capability } from '@ucanto/server'

import * as Type from './types.js'

const Decrypt = capability({
  can: 'space/content/decrypt',
  with: DID.match({ method: 'key' }),
  nb: Schema.struct({
    resource: Schema.link()
  }),
  derives: (child, parent) => {
    if (child.with !== parent.with) {
      return fail(`Can not derive ${child.can} with ${child.with} from ${parent.with}`)
    }
    if (child.nb.resource.toString() !== parent.nb.resource.toString()) {
      return fail(
        `Can not derive ${child.can} resource ${child.nb.resource} from ${parent.nb.resource}`
      )
    }
    return ok({})
  }
})

 /**
  * 
  * @param {Type.CreateDecryptWrappedInvocationOptions} param0 
  */
export const createDecryptWrappedInvocation = async ({ delegationCAR, issuer, spaceDID, resourceCID, audience, expiration }) => {
    const delegation = await extract(delegationCAR)
    if (delegation.error){
        throw delegation.error
    }
    
    const invocationOptions = {
        issuer,
        audience: DIDParser.parse(audience),
        with: spaceDID,
        nb: {
         resource: CID.parse(resourceCID)
        },
        expiration: expiration,
        proofs: [delegation.ok]
    }

    const decryptWrappedInvocation = await Decrypt.invoke(invocationOptions).delegate()

    const carEncoded = await decryptWrappedInvocation.archive()
    if(carEncoded.error){
        throw carEncoded.error
    }

    return dagJSON.stringify(carEncoded.ok)
 }