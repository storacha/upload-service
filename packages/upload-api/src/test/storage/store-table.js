import * as API from '../../types.js'

/**
 * @deprecated
 * @implements {API.LegacyStoreTable}
 */
export class StoreTable {
  constructor() {
    /** @type {(API.LegacyStoreAddInput & API.StoreListItem)[]} */
    this.items = []
  }

  /** @type {API.LegacyStoreTable['insert']} */
  async insert({ space, issuer, invocation, ...output }) {
    if (
      this.items.some((i) => i.space === space && i.link.equals(output.link))
    ) {
      return {
        error: { name: 'RecordKeyConflict', message: 'record key conflict' },
      }
    }
    this.items.unshift({
      space,
      issuer,
      invocation,
      ...output,
      insertedAt: new Date().toISOString(),
    })
    return { ok: output }
  }

  /** @type {API.LegacyStoreTable['inspect']} */
  async inspect(link) {
    const items = this.items.filter((item) => item.link.equals(link))
    return {
      ok: {
        spaces: items.map((item) => ({
          did: item.space,
          insertedAt: item.insertedAt,
        })),
      },
    }
  }

  /** @type {API.LegacyStoreTable['get']} */
  async get(space, link) {
    const item = this.items.find(
      (i) => i.space === space && i.link.equals(link)
    )
    if (!item) {
      return { error: { name: 'RecordNotFound', message: 'record not found' } }
    }
    return { ok: item }
  }

  /** @type {API.LegacyStoreTable['exists']} */
  async exists(space, link) {
    const item = this.items.find(
      (i) => i.space === space && i.link.equals(link)
    )
    return { ok: !!item }
  }

  /** @type {API.LegacyStoreTable['remove']} */
  async remove(space, link) {
    const item = this.items.find(
      (i) => i.space === space && i.link.equals(link)
    )
    if (!item) {
      return { error: { name: 'RecordNotFound', message: 'record not found' } }
    }
    this.items = this.items.filter((i) => i !== item)
    return { ok: item }
  }

  /** @type {API.LegacyStoreTable['list']} */
  async list(
    space,
    { cursor = '0', pre = false, size = this.items.length } = {}
  ) {
    const offset = parseInt(cursor, 10)
    const items = pre ? this.items.slice(0, offset) : this.items.slice(offset)

    const matches = [...items.entries()]
      .filter(([n, item]) => item.space === space)
      .slice(0, size)

    if (matches.length === 0) {
      return { ok: { size: 0, results: [] } }
    }

    const first = matches[0]
    const last = matches[matches.length - 1]

    const start = first[0] || 0
    const end = last[0] || 0
    const values = matches.map(([_, item]) => item)

    const [before, after, results] = pre
      ? [`${start}`, `${end + 1}`, values]
      : [`${start + offset}`, `${end + 1 + offset}`, values]

    return {
      ok: {
        size: values.length,
        before,
        after,
        cursor: after,
        results,
      },
    }
  }
}
