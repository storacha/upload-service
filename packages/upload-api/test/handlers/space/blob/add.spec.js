import { test } from '../../../../src/test/test.js'
import * as BlobAdd from '../../../../src/test/handlers/space/blob/add.js'

test(
  { 'space/blob/add': BlobAdd.test },
  {
    providers: {
      'did:web:test.up.storacha.network': 0,
      'did:web:testlimit.up.storacha.network': 1000,
    },
  }
)
