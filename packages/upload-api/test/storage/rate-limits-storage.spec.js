import * as RateLimitsStorage from '../../src/test/storage/rate-limits-storage-tests.js'
import { test } from '../../src/test/test.js'
test({ 'in memory rate limits storage': RateLimitsStorage.test })
