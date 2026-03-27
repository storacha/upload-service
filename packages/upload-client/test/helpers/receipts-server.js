import * as CAR from '@ucanto/transport/car'
import { Message } from '@ucanto/core'
import { createServer } from 'http'
import { randomCAR } from './random.js'
import { generateAcceptReceipt } from '../helpers/utils.js'

const port = process.env.PORT ?? 9201

/**
 * @param {string} taskCid
 */
const encodeReceipt = async (taskCid) => {
  const receipt = await generateAcceptReceipt(taskCid)
  const message = await Message.build({
    receipts: [receipt],
  })
  return CAR.request.encode(message).body
}

const server = createServer(async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')

    const taskCid = req.url?.split('/')[1]
    if (!taskCid) {
      res.writeHead(204)
      res.end()
    } else if (taskCid === 'unavailable') {
      res.writeHead(404)
      res.end()
    } else if (taskCid === 'failed') {
      const body = await encodeReceipt((await randomCAR(128)).cid.toString())
      res.writeHead(200)
      res.end(body)
    } else {
      const body = await encodeReceipt(taskCid)
      res.writeHead(200)
      res.end(body)
    }
  } catch (error) {
    process.stderr.write(`Error handling request: ${error}\n`)
    if (!res.headersSent) {
      res.writeHead(500)
    }
    res.end()
  }
})

server
  .listen(port, () => {
    process.stdout.write(`Listening on :${port}\n`)
  })
  .on('error', (err) => {
    process.stderr.write(
      `Failed to start server on port ${port}: ${err.message}\n`
    )
    process.exit(1)
  })

process.on('SIGTERM', () => process.exit(0))
