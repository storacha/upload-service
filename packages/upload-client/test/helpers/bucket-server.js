import { createServer } from 'http'

const port = process.env.PORT ?? 9000
const status = process.env.STATUS ? parseInt(process.env.STATUS) : 200

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.end()
  res.statusCode = status
  res.end()
})

server.listen(port, () => console.log(`Listening on :${port}`))
  .on('error', (err) => {
    console.error(`Failed to start server on port ${port}:`, err.message)
    process.exit(1)
  })

process.on('SIGTERM', () => process.exit(0))
