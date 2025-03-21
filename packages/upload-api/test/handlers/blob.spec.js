import { test } from '../../src/test/test.js'
import * as Blob from '../../src/test/handlers/blob.js'

test({ 'blob/*': Blob.test })
