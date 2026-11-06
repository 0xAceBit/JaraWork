/**
 * POST /mcp: MCP over Streamable HTTP, stateless (a fresh server and transport per request),
 * JSON responses (no SSE), so it behaves behind Render's proxy and needs no session store.
 * API per the official SDK docs (v1.x, simpleStatelessStreamableHttp example), adapted from
 * Express to plain Node http: the transport accepts Node's IncomingMessage/ServerResponse.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createValidatorMcpServer } from './mcp.ts'
import { createStubProbes } from './probes.ts'
import type { Probes } from './probes.ts'

const MAX_BODY_BYTES = 64 * 1024

function rpcError(res: ServerResponse, status: number, code: number, message: string): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new RangeError('body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  probes: Probes = createStubProbes(),
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return rpcError(res, 405, -32000, 'Method not allowed. Use POST.')
  }

  let body: unknown
  try {
    body = JSON.parse(await readBody(req))
  } catch (err) {
    if (err instanceof RangeError) return rpcError(res, 413, -32600, 'Request body too large.')
    return rpcError(res, 400, -32700, 'Parse error: the body is not valid JSON.')
  }

  const server = createValidatorMcpServer(probes)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    void transport.close()
    void server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  } catch (err) {
    console.error('MCP request failed:', err instanceof Error ? err.message : String(err))
    rpcError(res, 500, -32603, 'Internal server error.')
  }
}
