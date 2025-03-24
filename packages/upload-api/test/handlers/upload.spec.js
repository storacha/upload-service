import * as Upload from '../../src/test/handlers/upload.js'
import { test } from '../../src/test/test.js'
test({ 'upload/*': Upload.test })
