import assert from 'assert'
import * as Server from '@ucanto/server'
// NOTE: These tests target T2 (ServiceUnavailable Failure class). The symbol
// does not yet exist in ../../src/errors.js — these tests are expected to be
// RED until the implementation lands.
import { ServiceUnavailable, ServiceUnavailableName } from '../../src/errors.js'

describe('errors: ServiceUnavailable', () => {
  it('exports a ServiceUnavailableName constant equal to "ServiceUnavailable"', () => {
    assert.equal(ServiceUnavailableName, 'ServiceUnavailable')
  })

  it('ServiceUnavailable is a subclass of Server.Failure', () => {
    const failure = new ServiceUnavailable('writes are disabled')
    assert.ok(
      failure instanceof Server.Failure,
      'ServiceUnavailable should extend Server.Failure'
    )
  })

  it('has name === "ServiceUnavailable"', () => {
    const failure = new ServiceUnavailable('writes are disabled')
    assert.equal(failure.name, 'ServiceUnavailable')
    assert.equal(failure.name, ServiceUnavailableName)
  })

  it('preserves the message passed to the constructor', () => {
    const failure = new ServiceUnavailable('writes are disabled')
    assert.equal(failure.message, 'writes are disabled')
  })

  it('exposes .reason getter that returns the message', () => {
    const failure = new ServiceUnavailable('writes are disabled')
    assert.equal(failure.reason, 'writes are disabled')
  })
})
