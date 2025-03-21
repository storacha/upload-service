import { test } from '../../src/test/test.js'
import * as Index from '../../src/test/handlers/index.js'

test({ 'index/*': Index.test })
