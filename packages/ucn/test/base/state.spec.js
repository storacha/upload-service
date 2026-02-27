import { describe, it, assert } from 'vitest'
import * as Name from '../../src/base/name.js'
import * as Revision from '../../src/base/revision.js'
import * as State from '../../src/base/state.js'

describe('state', () => {
  it('should create state with name and revisions', async () => {
    const name = await Name.create()
    const rev = await Revision.v0('test-value')
    const state = State.create(name, [rev])
    assert.equal(state.name.did(), name.did())
    assert.equal(state.revision.length, 1)
    assert.equal(state.revision[0].value, 'test-value')
  })

  it('should create state with multiple revisions', async () => {
    const name = await Name.create()
    const rev0 = await Revision.v0('value-0')
    const rev1 = await Revision.v0('value-1')
    const state = State.create(name, [rev0, rev1])
    assert.equal(state.revision.length, 2)
    assert.equal(state.revision[0].value, 'value-0')
    assert.equal(state.revision[1].value, 'value-1')
  })

  it('should create state with empty revisions', async () => {
    const name = await Name.create()
    const state = State.create(name, [])
    assert.equal(state.revision.length, 0)
  })
})
