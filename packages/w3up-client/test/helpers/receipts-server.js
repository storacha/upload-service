import { createServer } from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { parseLink } from '@ucanto/server'
import * as Signer from '@ucanto/principal/ed25519'
import { Receipt, Message } from '@ucanto/core'
import * as CAR from '@ucanto/transport/car'
import { Assert } from '@web3-storage/content-claims/capability'
import { randomCAR } from './random.js'

const port = process.env.PORT ?? 9201
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureName = process.env.FIXTURE_NAME || 'workflow.car'
const fixtureContent = fs.readFileSync(
  path.resolve(`${__dirname}`, '..', 'fixtures', fixtureName)
)

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')

  const parts = new URL(req.url ?? '', 'http://localhost').pathname.split('/')
  let task, content

  // If request URL is structure like: `/content/:digest/task/:cid`
  // ...then we can issue a location claim for the passed digest.
  if (parts[1] === 'content') {
    task = parseLink(parts[4])
    content = { digest: Digest.decode(base58btc.decode(parts[2])).bytes }
  } else {
    task = parseLink(parts[1])
    content = (await randomCAR(128)).cid
  }

  if (
    task.toString() ===
    'bafyreibo6nqtvp67daj7dkmeb5c2n6bg5bunxdmxq3lghtp3pmjtzpzfma'
  ) {
    res.writeHead(200, {
      'Content-disposition': 'attachment; filename=' + fixtureName,
    })
    return res.end(fixtureContent)
  }

  const issuer = await Signer.generate()
  const locationClaim = await Assert.location.delegate({
    issuer,
    audience: issuer,
    with: issuer.toDIDKey(),
    nb: {
      content,
      location: ['http://localhost'],
    },
    expiration: Infinity,
  })

  const receipt = await Receipt.issue({
    issuer,
    fx: {
      fork: [locationClaim],
    },
    ran: task,
    result: {
      ok: {
        site: locationClaim.link(),
      },
    },
  })

  const message = await Message.build({
    receipts: [receipt],
  })
  const request = CAR.request.encode(message)
  res.writeHead(200)
  res.end(request.body)
})

server.listen(port, () => console.log(`Listening on :${port}`))

/** @param {Error} err */
server.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error(`Failed to start receipts server on port ${port}: ${err.message}`)
  process.exit(1)
})

process.on('SIGTERM', () => process.exit(0))
