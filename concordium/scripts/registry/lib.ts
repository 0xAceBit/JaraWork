/**
 * Shared helpers for the registry scripts. Public data only: no key is ever
 * passed through show() or the transcript, and any value of the owner key that
 * ends up in an output string is redacted.
 */
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const paths = {
  root: ROOT,
  cardFile: join(ROOT, 'public', 'agent-card.json'),
  data: join(ROOT, '.data'),
  state: join(ROOT, '.data', 'registry-state.json'),
  transcript: join(ROOT, 'trajectory', 'registry', 'transcript.jsonl'),
}

// Separate env file for this module. Never the live app's .env.
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'))

export const config = {
  network: 'testnet',
  registryMcp: 'https://agent-registry-mcp.concordium.com/mcp',
  grpcHost: process.env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com',
  grpcPort: Number(process.env.CCD_GRPC_PORT ?? 20000),
  owner: process.env.CCD_OWNER_ADDRESS ?? '47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk',
  baseUrl: process.env.PUBLIC_BASE_URL ?? 'https://jarawork-agent.onrender.com',
  cardPath: '/.well-known/agent-card.json',
}

export const cardUrl = (): string => `${config.baseUrl}${config.cardPath}`
export const sha256Hex = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex')

function bigintSafe(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

function redact(text: string): string {
  const secret = process.env.CCD_OWNER_PRIVATE_KEY
  return secret && secret.length > 8 ? text.split(secret).join('[REDACTED]') : text
}

export function show(label: string, value: unknown): void {
  console.log(`\n${label}\n${redact(JSON.stringify(value, bigintSafe, 2) ?? 'undefined')}`)
}

export interface RegistryState {
  agentUri?: string
  cardSha256?: string
  previousCardSha256?: string
  tokenId?: string
  tokenAddress?: string
  registerTx?: string
  setUriTx?: string
}

export function readState(): RegistryState {
  return existsSync(paths.state) ? (JSON.parse(readFileSync(paths.state, 'utf8')) as RegistryState) : {}
}

export function writeState(patch: RegistryState): RegistryState {
  mkdirSync(paths.data, { recursive: true })
  const next = { ...readState(), ...patch }
  writeFileSync(paths.state, JSON.stringify(next, null, 2))
  return next
}

function appendTranscript(entry: Record<string, unknown>): void {
  mkdirSync(dirname(paths.transcript), { recursive: true })
  appendFileSync(paths.transcript, redact(JSON.stringify(entry, bigintSafe)) + '\n')
}

/** Calls one registry MCP tool. Prints and records the full request and response. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const request = { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }
  show(`REQUEST  tools/call ${name}`, request.params)
  const res = await fetch(config.registryMcp, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(request),
  })
  const body = (await res.json()) as { result?: { content?: { text?: string }[]; isError?: boolean }; error?: unknown }
  const text = body.result?.content?.[0]?.text
  let parsed: unknown = body
  if (text !== undefined) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  const failed = Boolean(body.result?.isError) || Boolean(body.error)
  show(`RESPONSE ${name} (HTTP ${res.status}${failed ? ', ERROR' : ''})`, parsed)
  appendTranscript({ at: new Date().toISOString(), tool: name, request: request.params, httpStatus: res.status, isError: failed, response: parsed })
  if (failed || typeof parsed !== 'object' || parsed === null) throw new Error(`${name} failed. See the response above.`)
  return parsed as Record<string, unknown>
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Add it to concordium/.env (see .env.example).`)
  return value
}

export function flagValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

export const hasFlag = (flag: string): boolean => process.argv.includes(flag)
