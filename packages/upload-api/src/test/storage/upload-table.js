import * as API from '../../types.js'
import { parseLink } from '@ucanto/core'

/**
 * @implements {API.UploadTable}
 */
export class UploadTable {
  constructor() {
    /** @type {(API.UploadListItem & API.UploadAddInput)[]} */
    this.items = []
  }

  /**
   * @param {API.UnknownLink} link
   * @returns {ReturnType<API.UploadTable['inspect']>}
   */
  async inspect(link) {
    const items = this.items.filter((item) => item.root.equals(link))
    return {
      ok: {
        spaces: items.map((item) => ({
          did: item.space,
          insertedAt: item.insertedAt,
        })),
      },
    }
  }

  /**
   * @param {API.UploadAddInput} input
   * @returns {ReturnType<API.UploadTable['upsert']>}
   */
  async upsert({ space, issuer, cause, root, shards = [] }) {
    const time = new Date().toISOString()
    const item = this.items.find(
      (item) => item.space === space && item.root.toString() === root.toString()
    )

    if (item) {
      const next = new Set([
        ...(item.shards || []).map(String),
        ...shards.map(String),
      ])

      Object.assign(item, {
        shards: [...next].map(($) => parseLink($)),
        updatedAt: time,
      })
    } else {
      this.items.unshift({
        space,
        issuer,
        cause,
        root,
        shards,
        insertedAt: time,
        updatedAt: time,
      })
    }

    // The OK type here (API.UploadAddSuccess) allows us to return the shards,
    // but it's optional, and that list can be extremely long. Omit it in case
    // it's an absurd amount of data to return. After all, the caller already
    // has the list. It's never different from what they asked for.
    return { ok: { root } }
  }

  /**
   * @param {API.DID} space
   * @param {API.UnknownLink} root
   * @returns {ReturnType<API.UploadTable['remove']>}
   */
  async remove(space, root) {
    const item = this.items.find(
      (i) => i.space === space && i.root.equals(root)
    )
    if (!item) {
      return { error: { name: 'RecordNotFound', message: 'record not found' } }
    }
    this.items = this.items.filter((i) => i !== item)
    return { ok: { root } }
  }

  /**
   * @param {API.DID} space
   * @param {API.UnknownLink} root
   * @returns {ReturnType<API.UploadTable['get']>}
   */
  async get(space, root) {
    const item = this.items.find(
      (i) => i.space === space && i.root.equals(root)
    )
    if (!item) {
      return { error: { name: 'RecordNotFound', message: 'record not found' } }
    }
    return {
      ok: {
        root: item.root,
        insertedAt: item.insertedAt,
        updatedAt: item.updatedAt,
      },
    }
  }

  /**
   * @param {API.DID} space
   * @param {API.UnknownLink} link
   * @returns {ReturnType<API.UploadTable['exists']>}
   */
  async exists(space, link) {
    const item = this.items.find(
      (i) => i.space === space && i.root.equals(link)
    )
    return { ok: !!item }
  }

  /**
   * @param {API.DID} space
   * @param {API.ListOptions} options
   * @returns {ReturnType<API.UploadTable['list']>}
   */
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

  /** @type {API.UploadTable['listShards']} */
  async listShards(space, root, options) {
    const item = this.items.find(
      (i) => i.space === space && i.root.equals(root)
    )
    if (!item) {
      return { error: { name: 'RecordNotFound', message: 'record not found' } }
    }

    const size = Math.max(1, options?.size ?? 1000)
    const start = parseInt(options?.cursor ?? '0', 10)
    const end = start + size
    const shards = item.shards ?? []
    const results = shards.slice(start, end)
    const cursor = end >= shards.length ? undefined : `${end}`

    return { ok: { size: shards.length, results, cursor } }
  }
}
