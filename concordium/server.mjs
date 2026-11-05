/**
 * Concordium hackathon service skeleton. Runs on Node, not Bun (see README).
 * Isolated from the live JaraWork app. Port 3002 locally.
 */
import { createServer } from 'node:http'
import { ConcordiumGRPCWebClient } from '@concordium/web-sdk'

const PORT = Number(process.env.PORT ?? process.env.CONCORDIUM_PORT ?? 3002)
const NODE_HOST = process.env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com'
const NODE_PORT = Number(process.env.CCD_GRPC_PORT ?? 20000)
const NETWORK = process.env.CCD_NETWORK ?? 'testnet'

const client = new ConcordiumGRPCWebClient(`https://${NODE_HOST}`, NODE_PORT, { timeout: 15000 })

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function handle(req, res) {
  const path = (req.url ?? '/').split('?')[0]
  try {
    if (path === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'jarawork-concordium',
        runtime: `node ${process.version}`,
        network: NETWORK,
        time: new Date().toISOString(),
      })
    }
    if (path === '/chain') {
      const status = await client.getConsensusStatus()
      return json(res, 200, {
        ok: true,
        network: NETWORK,
        lastFinalizedBlockHeight: String(status.lastFinalizedBlockHeight),
      })
    }
    return json(res, 404, { ok: false, error: 'not found', routes: ['/health', '/chain'] })
  } catch (err) {
    return json(res, 502, { ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

const server = createServer((req, res) => {
  void handle(req, res)
})

server.listen(PORT, () => console.log(`jarawork-concordium listening on :${PORT} (${NETWORK})`))
