/**
 * Day-one compatibility smoke test for @concordium/web-sdk.
 * Run under Bun and under Node and compare. Read-only, no keys, no funds.
 */
const runtime = typeof (globalThis as any).Bun !== 'undefined' ? `bun ${(globalThis as any).Bun.version}` : `node ${process.version}`
const TESTNET_HOST = 'grpc.testnet.concordium.com'
const TESTNET_PORT = 20000
const REGISTRY = 'https://agent-registry-mcp.concordium.com'

type Result = { name: string; ok: boolean; detail: string }
const results: Result[] = []

async function step(name: string, fn: () => Promise<string>, timeoutMs = 20000) {
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)),
    ])
    results.push({ name, ok: true, detail })
  } catch (e) {
    results.push({ name, ok: false, detail: (e as Error)?.message?.slice(0, 200) ?? String(e) })
  }
}

await step('1. import @concordium/web-sdk (main entry)', async () => {
  const sdk = await import('@concordium/web-sdk')
  return `loaded, ${Object.keys(sdk).length} exports`
})

await step('2. WASM entrypoint: token address helpers', async () => {
  const sdk: any = await import('@concordium/web-sdk')
  const fn = sdk.tokenAddressToBase58 ?? sdk.CIS2?.tokenAddressToBase58
  if (!fn) return 'helper not found on main entry (skipped, not a failure of WASM load)'
  return 'helper present'
})

await step('3. gRPC-web client (fetch transport) getConsensusStatus', async () => {
  const { ConcordiumGRPCWebClient } = await import('@concordium/web-sdk')
  const client = new ConcordiumGRPCWebClient(`https://${TESTNET_HOST}`, TESTNET_PORT, { timeout: 15000 })
  const status = await client.getConsensusStatus()
  return `ok, last finalized height ${status.lastFinalizedBlockHeight}`
})

await step('4. gRPC node client (@grpc/grpc-js) getConsensusStatus', async () => {
  const { ConcordiumGRPCNodeClient, credentials } = await import('@concordium/web-sdk/nodejs')
  const client = new ConcordiumGRPCNodeClient(TESTNET_HOST, TESTNET_PORT, credentials.createSsl(), { timeout: 15000 } as any)
  const status = await client.getConsensusStatus()
  return `ok, last finalized height ${status.lastFinalizedBlockHeight}`
})

await step('5. hosted registry /healthz via plain fetch (no SDK)', async () => {
  const r = await fetch(`${REGISTRY}/healthz`)
  return `HTTP ${r.status}`
})

await step('6. hosted registry /openapi.json via plain fetch', async () => {
  const r = await fetch(`${REGISTRY}/openapi.json`)
  const j: any = await r.json()
  return `HTTP ${r.status}, ${Object.keys(j.paths ?? {}).length} REST paths`
})

console.log(`\n=== Concordium smoke test on ${runtime} ===`)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.detail}`)
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(0)
