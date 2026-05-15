import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadSelectedRootsFile } from '../src/helper/load-selected-roots-file.js'

const SPACE_DID = 'did:key:z6MkuK94Gm6w7t8dX6d5Lz4k9Y3r1s2q8p7n6m5v4u3t2r1'

/** @type {string[]} */
const tempDirs = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  )
})

describe('loadSelectedRootsFile', () => {
  it('loads selected roots for the current space', async () => {
    const { filePath } = await writeTempFile([
      'bafyroot1',
      'bafyroot2',
      'bafyroot3',
    ])

    await expect(
      loadSelectedRootsFile({ filePath, spaceDID: SPACE_DID })
    ).resolves.toEqual({
      [SPACE_DID]: ['bafyroot1', 'bafyroot2', 'bafyroot3'],
    })
  })

  it('fails when the file is empty', async () => {
    const { filePath } = await writeRawTempFile('[]')

    await expect(
      loadSelectedRootsFile({ filePath, spaceDID: SPACE_DID })
    ).rejects.toThrow(
      `loadSelectedRootsFile: selected roots file is empty: ${filePath}`
    )
  })

  it('fails clearly on malformed json', async () => {
    const { filePath } = await writeRawTempFile('["bafyroot1",')

    await expect(
      loadSelectedRootsFile({ filePath, spaceDID: SPACE_DID })
    ).rejects.toThrow(
      `loadSelectedRootsFile: invalid JSON array in ${filePath}`
    )
  })

  it('fails when the file is not a json array', async () => {
    const { filePath } = await writeRawTempFile('{"root":"bafyroot1"}')

    await expect(
      loadSelectedRootsFile({ filePath, spaceDID: SPACE_DID })
    ).rejects.toThrow(
      `loadSelectedRootsFile: expected a JSON array of root CID strings in ${filePath}`
    )
  })

  it('fails when an item is not a non-empty string', async () => {
    const { filePath } = await writeRawTempFile('["bafyroot1", 2]')

    await expect(
      loadSelectedRootsFile({ filePath, spaceDID: SPACE_DID })
    ).rejects.toThrow(
      `loadSelectedRootsFile: expected a non-empty root CID string at ${filePath}[2]`
    )
  })

  it('fails when the file repeats a root', async () => {
    const { filePath } = await writeTempFile(['bafyroot1', 'bafyroot1'])

    await expect(
      loadSelectedRootsFile({ filePath, spaceDID: SPACE_DID })
    ).rejects.toThrow(
      `loadSelectedRootsFile: duplicate root "bafyroot1" at ${filePath}[2]`
    )
  })
})

/**
 * @param {string[]} roots
 */
async function writeTempFile(roots) {
  return writeRawTempFile(JSON.stringify(roots, null, 2))
}

/**
 * @param {string} contents
 */
async function writeRawTempFile(contents) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'selected-roots-'))
  tempDirs.push(dir)
  const filePath = path.join(dir, 'selected-roots.json')
  await writeFile(filePath, contents, 'utf8')
  return { filePath }
}
