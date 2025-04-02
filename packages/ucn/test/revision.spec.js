import { describe, it, assert } from 'vitest'
import * as Name from '../src/name.js'
import * as Revision from '../src/revision.js'
import * as Value from '../src/value.js'

describe('revision', () => {
  it('should roundtrip archive/extract', async () => {
    const rev = await Revision.v0('/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui')
    const bytes = await rev.archive()
    const extracted = await Revision.extract(bytes)
    assert.equal(extracted.value, rev.value)
    assert.equal(extracted.event.cid.toString(), rev.event.cid.toString())
    assert.deepEqual(extracted.event.bytes, rev.event.bytes)
  })

  it('should roundtrip format/parse', async () => {
    const rev = await Revision.v0('/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui')
    const str = await Revision.format(rev)
    const parsed = await Revision.parse(str)
    assert.equal(parsed.value, rev.value)
    assert.equal(parsed.event.cid.toString(), rev.event.cid.toString())
    assert.deepEqual(parsed.event.bytes, rev.event.bytes)
  })

  it('should increment revision', async () => {
    const name = await Name.create()
    const val0 = '/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui'
    const rev0 = await Revision.v0(val0)
    const val1 = '/ipfs/bafybeiauyddeo2axgargy56kwxirquxaxso3nobtjtjvoqu552oqciudrm'
    const rev1 = await Revision.increment(Value.from(name, rev0), val1)
    assert.equal(rev1.value, val1)
    assert.equal(rev1.event.value.data, val1)
    assert.equal(rev1.event.value.parents.length, 1)
    assert.equal(rev1.event.value.parents[0].toString(), rev0.event.cid.toString())
  })

  it('should increment revision multi parent', async () => {
    const name = await Name.create()
    const val0 = '/ipfs/bafkreiem4twkqzsq2aj4shbycd4yvoj2cx72vezicletlhi7dijjciqpui'
    const rev0 = await Revision.v0(val0)

    const cur0 = Value.from(name, rev0)

    // create two conflicting revisions from the same value
    const val1 = '/ipfs/bafybeiauyddeo2axgargy56kwxirquxaxso3nobtjtjvoqu552oqciudrm'
    const rev1 = await Revision.increment(cur0, val1)
    const val2 = '/ipfs/bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy'
    const rev2 = await Revision.increment(cur0, val2)

    // create a third revision from the 2 conflicting revisions
    const val3 = '/ipfs/bafkreigg4a4z7o5m5pwzcfyphodsbbdp5sdiu5bwibdw5wvq5t24qswula'
    const rev3 = await Revision.increment(Value.from(name, rev1, rev2), val3)

    assert.equal(rev3.value, val3)
    assert.equal(rev3.event.value.data, val3)
    assert.equal(rev3.event.value.parents.length, 2)
    assert(rev3.event.value.parents.some(p => p.toString() === rev1.event.cid.toString()))
    assert(rev3.event.value.parents.some(p => p.toString() === rev2.event.cid.toString()))
  })
})