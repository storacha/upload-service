/** @typedef {import('../../types/usage.js').UsageStorage} UsageStore */

/** @implements {UsageStore} */
export class UsageStorage {
  /**
   * @param {import('./blob-registry.js').Registry} blobRegistry
   */
  constructor(blobRegistry) {
    this.blobRegistry = blobRegistry
    /**
     * @type {import('../types.js').EgressData[]}
     */
    this._egressRecords = []
  }

  get items() {
    return [...this.blobRegistry.data.entries()].flatMap(([space, entries]) =>
      entries.map((e) => ({ space, size: e.blob.size, ...e }))
    )
  }

  /**
   * @param {import('../types.js').ProviderDID} provider
   * @param {import('../types.js').SpaceDID} space
   * @param {{ from: Date, to: Date }} period
   */
  async report(provider, space, period) {
    const before = this.items.filter((item) => {
      const insertTime = new Date(item.insertedAt).getTime()
      return item.space === space && insertTime < period.from.getTime()
    })
    const during = this.items.filter((item) => {
      const insertTime = new Date(item.insertedAt).getTime()
      return (
        item.space === space &&
        insertTime >= period.from.getTime() &&
        insertTime < period.to.getTime()
      )
    })
    const initial = before.reduce((total, item) => (total += item.size), 0)
    const final = during.reduce((total, item) => (total += item.size), 0)

    return {
      ok: {
        provider,
        space,
        period: {
          from: period.from.toISOString(),
          to: period.to.toISOString(),
        },
        size: { initial, final },
        events: during.map((item) => {
          return {
            cause: /** @type {import('../types.js').Link} */ (item.cause),
            delta: item.size,
            receiptAt: item.insertedAt.toISOString(),
          }
        }),
      },
    }
  }

  /**
   * @param {import('../types.js').ProviderDID} provider
   * @param {import('../types.js').SpaceDID} space
   * @param {{ from: Date, to: Date }} period
   */
  async reportEgress(provider, space, period) {
    const events = this._egressRecords.filter((record) => {
      const servedAt = new Date(record.servedAt).getTime()
      return (
        record.space === space &&
        servedAt >= period.from.getTime() &&
        servedAt < period.to.getTime()
      )
    })

    return {
      ok: {
        provider,
        space,
        period: {
          from: period.from.toISOString(),
          to: period.to.toISOString(),
        },
        total: events.reduce((sum, e) => sum + e.bytes, 0),
      },
    }
  }

  /**
   * Simulate a record of egress data for a customer.
   *
   * @param {import('../types.js').SpaceDID} space
   * @param {import('../types.js').AccountDID} customer
   * @param {import('../types.js').UnknownLink} resource
   * @param {number} bytes
   * @param {Date} servedAt
   * @param {import('../types.js').UnknownLink} cause
   */
  async record(space, customer, resource, bytes, servedAt, cause) {
    /** @type {import('../types.js').EgressData} */
    const egressData = {
      space,
      customer,
      resource,
      bytes,
      servedAt: servedAt.toISOString(),
      cause,
    }
    this._egressRecords.push(egressData)
    return Promise.resolve({
      ok: egressData,
    })
  }

  get egressRecords() {
    return this._egressRecords
  }
}
