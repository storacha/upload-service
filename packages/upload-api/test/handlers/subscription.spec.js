import * as Subscription from '../../src/test/handlers/subscription.js'
import { test } from '../../src/test/test.js'
test({ 'subscription/*': Subscription.test })
