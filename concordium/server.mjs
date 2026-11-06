/**
 * Concordium hackathon service skeleton. Runs on Node, not Bun (see README).
 * Isolated from the live JaraWork app. Port 3002 locally.
 */
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { ConcordiumGRPCWebClient } from '@concordium/web-sdk'
import { handleMcpRequest } from './src/service/mcpHttp.ts'
import { createStubProbes } from './src/service/probes.ts'

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
 * @param {import('./src/service/probes.ts').Probes} probes
 */
async function handle(req, res, probes) {
  const path = (req.url ?? '/').split('?')[0]
  try {
    if (path === '/mcp') return await handleMcpRequest(req, res, probes)
    if (path === '/') {
      // Browsers get the friendly page; API clients (no text/html in Accept) keep the JSON description.
      if ((req.headers.accept ?? '').includes('text/html')) {
        const page = await readFile(new URL('./public/index.html', import.meta.url))
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'content-length': page.length })
        return res.end(page)
      }
      return json(res, 200, {
        service: 'jarawork-concordium',
        description: 'Isolated Concordium hackathon service for JaraWork. Testnet only.',
        network: NETWORK,
        routes: ['/health', '/chain', '/mcp', '/.well-known/agent-card.json'],
      })
    }
    if (path === '/.well-known/agent-card.json') {
      // Serve the file's raw bytes untouched: the on-chain hash is over these exact bytes.
      const bytes = await readFile(new URL('./public/agent-card.json', import.meta.url))
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': bytes.length,
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      })
      return res.end(bytes)
    }
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
    return json(res, 404, { ok: false, error: 'not found', routes: ['/health', '/chain', '/mcp'] })
  } catch (err) {
    return json(res, 502, { ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

/**
 * Builds the HTTP server without starting it, so tests can run it on a random port.
 * @param {{ probes?: import('./src/service/probes.ts').Probes }} [options]
 */
export function createAppServer(options = {}) {
  const probes = options.probes ?? createStubProbes()
  return createServer((req, res) => {
    void handle(req, res, probes)
  })
}

// Start listening only when run directly (`node server.mjs`), not when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAppServer()
  server.listen(PORT, () => console.log(`jarawork-concordium listening on :${PORT} (${NETWORK})`))

  // Render sends SIGTERM on redeploy; close cleanly instead of dropping requests.
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0))
  })
}
