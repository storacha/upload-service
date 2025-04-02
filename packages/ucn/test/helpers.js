import { ok, error } from '@ucanto/server'
import * as ed25519 from '@ucanto/principal/ed25519'

/** @import * as API from '../src/server/api.js' */

export class MemoryHeadStorage {
  constructor() {
    /** @type {Record<string, API.HeadEvent[]>} */
    this.heads = {}
  }

  /** @type {API.HeadStorage['get']} */
  async get(clock) {
    return this.heads[clock]
      ? ok(this.heads[clock])
      : error(/** @type {API.NotFound} */ ({ name: 'NotFound' }))
  }

  /** @type {API.HeadStorage['put']} */
  async put(clock, head) {
    this.heads[clock] = head
    return ok({})
  }
}

export const fixtures = {
  values: [
    '/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui',
    '/ipfs/bafybeiauyddeo2axgargy56kwxirquxaxso3nobtjtjvoqu552oqciudrm',
    '/ipfs/bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy',
    '/ipfs/bafkreigg4a4z7o5m5pwzcfyphodsbbdp5sdiu5bwibdw5wvq5t24qswula',
  ],
  /** did:key:z6Mkk89bC3JrVqKie71YEcc5M1SMVxuCgNx6zLZ8SYJsxALi */
  alice: ed25519.parse(
    'MgCZT5vOnYZoVAeyjnzuJIVY9J4LNtJ+f8Js0cTPuKUpFne0BVEDJjEu6quFIU8yp91/TY/+MYK8GvlKoTDnqOCovCVM='
  ),
  /** did:key:z6MkffDZCkCTWreg8868fG1FGFogcJj5X6PY93pPcWDn9bob */
  bob: ed25519.parse(
    'MgCYbj5AJfVvdrjkjNCxB3iAUwx7RQHVQ7H1sKyHy46Iose0BEevXgL1V73PD9snOCIoONgb+yQ9sycYchQC8kygR4qY='
  ),
  /** did:key:z6MktafZTREjJkvV5mfJxcLpNBoVPwDLhTuMg9ng7dY4zMAL */
  mallory: ed25519.parse(
    'MgCYtH0AvYxiQwBG6+ZXcwlXywq9tI50G2mCAUJbwrrahkO0B0elFYkl3Ulf3Q3A/EvcVY0utb4etiSE8e6pi4H0FEmU='
  ),
  service: ed25519.parse(
    'MgCYKXoHVy7Vk4/QjcEGi+MCqjntUiasxXJ8uJKY0qh11e+0Bs8WsdqGK7xothgrDzzWD0ME7ynPjz2okXDh8537lId8='
  ),
}
