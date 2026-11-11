import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createAppServer } from '../server.mjs'
import { sha256Hex } from '../src/service/evidence.ts'

const CARD_FILE = new URL('../public/agent-card.json', import.meta.url)
// The hash pinned on chain for token 1008 (setAgentURI, 2026-11-05). If you edit the card
// you MUST re-host and re-pin it (scripts/registry 06 and 07) and update this constant.
const PINNED_CARD_SHA256 = 'a5a7ed0ac2a0c8693d38080d7be2db937b579ae726d6d9e9a40ba3f77ab7b0cb'
const CID_V0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const proof = (type: string, value: string, carrier = ''): string => JSON.stringify({ type, value, carrier, note: '' })

const server = createAppServer()
let base = ''
let client: Client

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)))
})

after(async () => {
  await client.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function call(args: Record<string, unknown>) {
  const result = await client.callTool({ name: 'validate_delivery_proof', arguments: args })
  return { result, verdict: result.structuredContent as Record<string, unknown> | undefined }
}

void describe('MCP tool over HTTP, via the official client', () => {
  void it('lists exactly one tool, with schemas and an honest description', async () => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name), ['validate_delivery_proof'])
    const tool = tools[0]
    assert.ok(tool?.outputSchema, 'declares an output schema')
    assert.deepEqual(tool.inputSchema.required, ['proof'])
    assert.match(tool.description ?? '', /SIMULATED/)
  })

  void it('valid proof: verdict, reason and evidence hash come back as structured content', async () => {
    const { result, verdict } = await call({ proof: proof('tracking', '1Z999AA10123456784', 'UPS'), orderRef: 'demo-1' })
    assert.notEqual(result.isError, true)
    assert.equal(verdict?.verdict, 'pass')
    assert.equal(typeof verdict?.reason, 'string')
    assert.match(String(verdict?.evidenceHash), /^[0-9a-f]{64}$/)
    assert.equal(verdict?.simulated, true)
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? ''
    assert.deepEqual(JSON.parse(text), verdict, 'the text content mirrors the structured content')
  })

  void it('invalid proof: a fail verdict, not a protocol error', async () => {
    const { result, verdict } = await call({ proof: proof('tracking', '1Z999AA10123456785', 'UPS') })
    assert.notEqual(result.isError, true)
    assert.equal(verdict?.verdict, 'fail')
    assert.equal(verdict?.code, 'NOT_CONFIRMED')
  })

  void it('tampered proof: one changed character flips the verdict and the evidence hash', async () => {
    const good = (await call({ proof: proof('ipfs', CID_V0) })).verdict
    const bad = (await call({ proof: proof('ipfs', `${CID_V0.slice(0, -1)}H`) })).verdict
    assert.equal(good?.verdict, 'pass')
    assert.equal(bad?.verdict, 'fail')
    assert.notEqual(good?.evidenceHash, bad?.evidenceHash)
  })

  void it('malformed input: wrong types are rejected by the schema, bad content gets a BAD_INPUT verdict', async () => {
    let rejected = false
    try {
      const { result } = await call({ proof: 123 })
      rejected = result.isError === true
    } catch {
      rejected = true
    }
    assert.ok(rejected, 'a non-string proof must be rejected before it reaches the validator')

    const { verdict } = await call({ proof: '' })
    assert.equal(verdict?.verdict, 'fail')
    assert.equal(verdict?.code, 'BAD_INPUT')
  })
})

void describe('HTTP edge cases on /mcp', () => {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }

  void it('only POST is allowed', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await fetch(`${base}/mcp`, { method })
      assert.equal(res.status, 405, method)
      assert.equal(res.headers.get('allow'), 'POST')
    }
  })

  void it('invalid JSON is a 400 parse error', async () => {
    const res = await fetch(`${base}/mcp`, { method: 'POST', headers, body: '{not json' })
    assert.equal(res.status, 400)
    const body = (await res.json()) as { error: { code: number } }
    assert.equal(body.error.code, -32700)
  })

  void it('an oversized body is refused with 413', async () => {
    const res = await fetch(`${base}/mcp`, { method: 'POST', headers, body: JSON.stringify({ pad: 'x'.repeat(70_000) }) })
    assert.equal(res.status, 413)
  })
})

void describe('Agent Card', () => {
  void it('is served byte for byte, unchanged, at the registered path', async () => {
    const onDisk = readFileSync(CARD_FILE)
    const res = await fetch(`${base}/.well-known/agent-card.json`)
    const served = Buffer.from(await res.arrayBuffer())
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /application\/json/)
    assert.ok(served.equals(onDisk), 'served bytes are identical to the file')
    assert.equal(sha256Hex(served), PINNED_CARD_SHA256, 'the bytes hash to the value pinned on chain')
  })

  void it('adding /mcp did not change the card: it still carries the real token address and registration', () => {
    const card = JSON.parse(readFileSync(CARD_FILE, 'utf8')) as {
      capabilities: { extensions: { params: { tokenAddress: string } }[] }
      registrations: { agentId: number }[]
    }
    assert.match(card.capabilities.extensions[0]?.params.tokenAddress ?? '', /cis-2:JyP9YR6Wk3YPaGx3e8zyu$/)
    assert.equal(card.registrations[0]?.agentId, 1008)
  })
})

void describe('Agent Card vs the live registry', { skip: process.env.LIVE_REGISTRY !== '1' }, () => {
  void it('the file in this repo hashes to what the chain has pinned for token 1008', async () => {
    const res = await fetch('https://agent-registry-mcp.concordium.com/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'agent_of', arguments: { network: 'testnet', token_id: 1008 } } }),
    })
    const data = (await res.json()) as { result: { content: { text: string }[] } }
    const agent = JSON.parse(data.result.content[0]?.text ?? '{}') as { metadata_hash_hex: string; agent_uri: string }
    assert.equal(agent.metadata_hash_hex, sha256Hex(readFileSync(CARD_FILE)))
    assert.equal(new URL(agent.agent_uri).pathname, '/.well-known/agent-card.json')
  })
})
