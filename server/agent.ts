/**
 * JaraWork Autonomous Agent — Mode A (Platform-funded escrow)
 *
 * Responsibilities:
 *   1. Poll marketplace adapters every POLL_MS ms for new orders
 *   2. Auto-approve + create each new order on-chain (platform wallet pays USDC)
 *   3. Auto-release payment AUTO_RELEASE_DELAY_SECONDS after a worker submits delivery
 *   4. Auto-refund orders unclaimed for AUTO_REFUND_DELAY_SECONDS
 *
 * Runs on port 3001; Vite proxies /api/* to this server.
 */

import {
  initiateDeveloperControlledWalletsClient,
  type Transaction,
} from '@circle-fin/developer-controlled-wallets'
import { encodeFunctionData, keccak256, toHex } from 'viem'

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY        = process.env.CIRCLE_DEVELOPER_CONTROLLED_API_KEY ?? ''
const ENTITY_SECRET  = process.env.CIRCLE_ENTITY_SECRET ?? ''
const AGENT_WALLET_ID   = process.env.VITE_AGENT_WALLET_ID ?? ''
const CONTRACT_ADDRESS  = process.env.VITE_ESCROW_CONTRACT_ADDRESS ?? ''
const USDC_ADDRESS      = process.env.VITE_USDC_ADDRESS ?? ''
const BLOCKCHAIN = 'ARC-TESTNET'

const AUTO_RELEASE_DELAY_S = parseInt(process.env.AUTO_RELEASE_DELAY_SECONDS ?? '86400', 10)
const AUTO_REFUND_DELAY_S  = parseInt(process.env.AUTO_REFUND_DELAY_SECONDS  ?? '604800', 10)
const POLL_MS = parseInt(process.env.AGENT_POLL_MS ?? '60000', 10)
const PORT    = parseInt(process.env.AGENT_PORT ?? '3001', 10)

// ─── RPC URL (proxy-first, registry-fallback) ─────────────────────────────────

const _rpcProxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map(s => s.trim())
const _rpcUrl = (process.env.RPC_PROXY_BASE_URL && _rpcProxyChains.includes('Arc_Testnet'))
  ? `${process.env.RPC_PROXY_BASE_URL}/api/rpc/Arc_Testnet?_rpc_token=${process.env.RPC_PROXY_TOKEN}`
  : (() => {
      // Fallback: read the Arc Testnet RPC URL from the onchain-facts registry at runtime.
      // We do a dynamic require here (server-side only) to avoid a circular dep with vite/browser modules.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requireChain } = require('../src/onchain-facts.ts') as typeof import('../src/onchain-facts')
        const url = requireChain(5042002).rpcUrls[0]
        console.warn('[Agent] RPC proxy not available for Arc_Testnet — using public RPC from onchain-facts registry (rate limits unknown).')
        return url
      } catch {
        throw new Error('Could not resolve Arc Testnet RPC URL. Set RPC_PROXY_BASE_URL and RPC_PROXY_CHAINS=Arc_Testnet in .env.')
      }
    })()

// USDC address must be provided via VITE_USDC_ADDRESS in .env; it is a public on-chain value.
if (!USDC_ADDRESS) {
  console.error('[Agent] VITE_USDC_ADDRESS is not set. Add it to .env.')
}

// ─── SDK singleton ────────────────────────────────────────────────────────────

let _sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null
function getSDK() {
  if (!_sdk) {
    if (!API_KEY || !ENTITY_SECRET) throw new Error('CIRCLE_DEVELOPER_CONTROLLED_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env')
    _sdk = initiateDeveloperControlledWalletsClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET })
  }
  return _sdk
}

// ─── Action log (last 100, served to the UI) ─────────────────────────────────

export interface AgentAction {
  timestamp: number
  type: 'create_order' | 'confirm_delivery' | 'refund_order' | 'error' | 'info'
  orderId?: string
  marketplace?: string
  amount?: string
  txHash?: string
  message: string
}

const actionLog: AgentAction[] = []

function logAction(a: AgentAction) {
  actionLog.unshift(a)
  if (actionLog.length > 100) actionLog.length = 100
  const pfx = a.type === 'error' ? 'ERR' : a.type === 'info' ? 'INF' : 'OK '
  console.log(`[Agent] [${pfx}] ${a.message}`)
}

// ─── Dedup: track external order IDs already posted on-chain ─────────────────

const postedKeys = new Set<string>()

function computeOrderKey(marketplace: string, orderId: string): string {
  // Matches Solidity: keccak256(abi.encodePacked(marketplace, ":", orderId))
  return keccak256(toHex(`${marketplace}:${orderId}`))
}

// ─── Circle tx helpers ────────────────────────────────────────────────────────

async function waitForTx(txId: string): Promise<Transaction> {
  const TERMINAL = new Set(['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED'])
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await getSDK().getTransaction({ id: txId })
    const tx = res.data?.transaction as Transaction | undefined
    if (tx && TERMINAL.has(tx.state ?? '')) return tx
  }
  throw new Error(`Transaction ${txId} did not settle in 3 minutes`)
}

async function approveUsdc(amount: bigint): Promise<void> {
  if (!AGENT_WALLET_ID) throw new Error('VITE_AGENT_WALLET_ID not configured')
  if (!USDC_ADDRESS) throw new Error('VITE_USDC_ADDRESS not configured')
  if (!CONTRACT_ADDRESS) throw new Error('VITE_ESCROW_CONTRACT_ADDRESS not configured')

  const callData = encodeFunctionData({
    abi: [{
      name: 'approve', type: 'function', stateMutability: 'nonpayable',
      inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
      outputs: [{ type: 'bool' }],
    }],
    functionName: 'approve',
    args: [CONTRACT_ADDRESS as `0x${string}`, amount],
  })

  const res = await getSDK().createContractExecutionTransaction({
    walletId: AGENT_WALLET_ID,
    contractAddress: USDC_ADDRESS,
    callData,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  const tx = await waitForTx(res.data?.id ?? '')
  if (tx.state !== 'COMPLETE') throw new Error(`USDC approve failed: ${tx.state}`)
}

async function callEscrow(abiSig: string, params: string[]): Promise<string> {
  if (!AGENT_WALLET_ID) throw new Error('VITE_AGENT_WALLET_ID not configured')
  if (!CONTRACT_ADDRESS) throw new Error('VITE_ESCROW_CONTRACT_ADDRESS not configured')

  const res = await getSDK().createContractExecutionTransaction({
    walletId: AGENT_WALLET_ID,
    contractAddress: CONTRACT_ADDRESS,
    abiFunctionSignature: abiSig,
    abiParameters: params,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  const tx = await waitForTx(res.data?.id ?? '')
  if (tx.state !== 'COMPLETE') throw new Error(`${abiSig} failed: ${tx.state}`)
  return tx.txHash ?? ''
}

// ─── On-chain readers (raw JSON-RPC) ─────────────────────────────────────────

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(_rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = await res.json() as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(`RPC error: ${json.error.message}`)
  return json.result
}

async function readOrderKeys(funcSig: string): Promise<string[]> {
  if (!CONTRACT_ADDRESS) return []
  const selector = keccak256(toHex(funcSig)).slice(0, 10)
  const data = await rpcCall('eth_call', [{ to: CONTRACT_ADDRESS, data: selector }, 'latest'])
  if (!data || data === '0x') return []
  const hex = (data as string).slice(2)
  if (hex.length < 128) return []
  const count = parseInt(hex.slice(64, 128), 16)
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    const start = 128 + i * 64
    keys.push('0x' + hex.slice(start, start + 64))
  }
  return keys
}

interface OrderFields { status: number; createdAt: bigint; claimedAt: bigint; completedAt: bigint; amount: bigint }

async function readOrderFields(key: string): Promise<OrderFields | null> {
  if (!CONTRACT_ADDRESS) return null
  const selector = keccak256(toHex('getOrder(bytes32)')).slice(0, 10)
  const padded = key.slice(2).padStart(64, '0')
  const data = await rpcCall('eth_call', [{ to: CONTRACT_ADDRESS, data: `${selector}${padded}` }, 'latest'])
  if (!data || data === '0x') return null
  const hex = (data as string).slice(2)
  const word = (i: number) => BigInt('0x' + hex.slice(i * 64, i * 64 + 64))
  // Tuple head: [0]=orderId offset, [1]=title offset, [2]=desc offset, [3]=mktplace offset,
  // [4]=amount, [5]=buyer, [6]=worker, [7]=status, [8]=createdAt, [9]=claimedAt, [10]=completedAt, [11]=proof offset
  return {
    amount:      word(4),
    status:      Number(word(7)),
    createdAt:   word(8),
    claimedAt:   word(9),
    completedAt: word(10),
  }
}

// ─── Agent cycle tasks ────────────────────────────────────────────────────────

async function processMarketplaceOrders() {
  if (!AGENT_WALLET_ID || !CONTRACT_ADDRESS) {
    logAction({ timestamp: Date.now(), type: 'info', message: 'Wallet or contract not configured — skipping marketplace poll' })
    return
  }

  // Dynamically import the marketplace adapters (same repo, TypeScript via Bun)
  const { jaramarketAdapter } = await import('../src/lib/marketplaces/jaramarket.ts')
  const { amazonAdapter }     = await import('../src/lib/marketplaces/amazon.ts')
  const { ebayAdapter }       = await import('../src/lib/marketplaces/ebay.ts')
  const { jumiaAdapter }      = await import('../src/lib/marketplaces/jumia.ts')

  const adapters = [jaramarketAdapter, amazonAdapter, ebayAdapter, jumiaAdapter]
  const serverCfg: Record<string, { apiKey: string; extra: Record<string, string> }> = {
    jaramarket: { apiKey: process.env.JARAMARKET_API_KEY ?? '', extra: { storeUrl: process.env.JARAMARKET_STORE_URL ?? '' } },
    amazon:     { apiKey: process.env.AMAZON_ACCESS_KEY  ?? '', extra: { sellerId: process.env.AMAZON_SELLER_ID ?? '', marketplaceId: process.env.AMAZON_MARKETPLACE_ID ?? '' } },
    ebay:       { apiKey: process.env.EBAY_CLIENT_ID     ?? '', extra: { clientSecret: process.env.EBAY_CLIENT_SECRET ?? '' } },
    jumia:      { apiKey: process.env.JUMIA_API_KEY      ?? '', extra: { country: process.env.JUMIA_COUNTRY ?? 'ng' } },
  }

  for (const adapter of adapters) {
    const cfg = serverCfg[adapter.id]
    if (!cfg?.apiKey) continue

    let orders: Array<{ externalId: string; title: string; description: string; usdcAmount: string; sourceMarketplace: string }> = []
    try {
      orders = await adapter.fetchOrders(cfg.apiKey, cfg.extra)
    } catch (e) {
      logAction({ timestamp: Date.now(), type: 'error', message: `${adapter.id}: fetch error — ${(e as Error).message}` })
      continue
    }

    for (const order of orders) {
      const key = computeOrderKey(order.sourceMarketplace, order.externalId)
      if (postedKeys.has(key)) continue

      const amountFloat = parseFloat(order.usdcAmount)
      if (isNaN(amountFloat) || amountFloat <= 0) continue
      const amountRaw = BigInt(Math.round(amountFloat * 1_000_000))

      try {
        await approveUsdc(amountRaw)
        const txHash = await callEscrow(
          'createOrder(string,string,string,string,uint256)',
          [order.externalId, order.title, order.description ?? '', order.sourceMarketplace, amountRaw.toString()],
        )
        postedKeys.add(key)
        logAction({ timestamp: Date.now(), type: 'create_order', orderId: order.externalId, marketplace: order.sourceMarketplace, amount: order.usdcAmount, txHash, message: `Created order ${order.externalId} (${order.sourceMarketplace}) — $${order.usdcAmount} USDC` })
      } catch (e) {
        logAction({ timestamp: Date.now(), type: 'error', orderId: order.externalId, message: `Failed to create ${order.externalId}: ${(e as Error).message}` })
      }
    }
  }
}

async function processAutoRelease() {
  if (!CONTRACT_ADDRESS) return
  const now = BigInt(Math.floor(Date.now() / 1000))
  const keys = await readOrderKeys('getDeliveredOrders()').catch(() => [] as string[])

  for (const key of keys) {
    const o = await readOrderFields(key).catch(() => null)
    if (!o || o.status !== 2) continue
    if (now - o.completedAt < BigInt(AUTO_RELEASE_DELAY_S)) continue

    try {
      const txHash = await callEscrow('confirmDelivery(bytes32)', [key])
      const hoursWaited = (Number(now - o.completedAt) / 3600).toFixed(1)
      logAction({ timestamp: Date.now(), type: 'confirm_delivery', orderId: key.slice(0, 10), txHash, message: `Auto-released payment for ${key.slice(0, 10)}… (${hoursWaited}h after delivery)` })
    } catch (e) {
      logAction({ timestamp: Date.now(), type: 'error', message: `Auto-release failed for ${key.slice(0, 10)}: ${(e as Error).message}` })
    }
  }
}

async function processAutoRefund() {
  if (!CONTRACT_ADDRESS) return
  const now = BigInt(Math.floor(Date.now() / 1000))
  const keys = await readOrderKeys('getOpenOrders()').catch(() => [] as string[])

  for (const key of keys) {
    const o = await readOrderFields(key).catch(() => null)
    if (!o || o.status !== 0) continue
    if (now - o.createdAt < BigInt(AUTO_REFUND_DELAY_S)) continue

    try {
      const txHash = await callEscrow('refundOrder(bytes32)', [key])
      const daysOld = (Number(now - o.createdAt) / 86400).toFixed(1)
      logAction({ timestamp: Date.now(), type: 'refund_order', orderId: key.slice(0, 10), txHash, message: `Auto-refunded unclaimed order ${key.slice(0, 10)}… (${daysOld} days old)` })
    } catch (e) {
      logAction({ timestamp: Date.now(), type: 'error', message: `Auto-refund failed for ${key.slice(0, 10)}: ${(e as Error).message}` })
    }
  }
}

async function runCycle() {
  try {
    await Promise.allSettled([processMarketplaceOrders(), processAutoRelease(), processAutoRefund()])
  } catch (e) {
    logAction({ timestamp: Date.now(), type: 'error', message: `Cycle error: ${(e as Error).message}` })
  }
}

// ─── Agent wallet setup helper ────────────────────────────────────────────────

async function setupAgentWallet() {
  const sdk = getSDK()
  const wsRes = await sdk.createWalletSet({ name: 'JaraWork Platform WalletSet' })
  const walletSetId = wsRes.data?.walletSet?.id ?? ''
  if (!walletSetId) throw new Error('Failed to create wallet set')
  const wRes = await sdk.createWallets({ accountType: 'EOA', blockchains: [BLOCKCHAIN], count: 1, walletSetId })
  const wallet = wRes.data?.wallets?.[0]
  if (!wallet) throw new Error('Failed to create wallet')
  return { walletSetId, walletId: wallet.id, address: wallet.address ?? '' }
}

async function getAgentBalance(): Promise<string> {
  if (!AGENT_WALLET_ID) return '0.00'
  try {
    const res = await getSDK().getWalletTokenBalance({ id: AGENT_WALLET_ID })
    const bal = (res.data?.tokenBalances ?? []).find(b => b.token?.symbol === 'USDC')
    return bal?.amount ?? '0.00'
  } catch { return '0.00' }
}

// ─── HTTP server (plain Bun) ──────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })

    // Health
    if (path === '/health') return json({ ok: true })

    // Agent status
    if (path === '/agent/status' && req.method === 'GET') {
      const balance = await getAgentBalance()
      return json({ agentWalletId: AGENT_WALLET_ID || null, contractAddress: CONTRACT_ADDRESS || null, balance, pollIntervalMs: POLL_MS, autoReleaseDelayHours: AUTO_RELEASE_DELAY_S / 3600, autoRefundDelayDays: AUTO_REFUND_DELAY_S / 86400, actions: actionLog.slice(0, 30) })
    }

    // One-time wallet setup
    if (path === '/agent/setup' && req.method === 'POST') {
      if (AGENT_WALLET_ID) return json({ error: 'Already configured. Remove VITE_AGENT_WALLET_ID from .env to recreate.' }, 400)
      try {
        const w = await setupAgentWallet()
        logAction({ timestamp: Date.now(), type: 'info', message: `Agent wallet created: ${w.address}` })
        return json({ ...w, instructions: [`VITE_AGENT_WALLET_SET_ID=${w.walletSetId}`, `VITE_AGENT_WALLET_ID=${w.walletId}`, `Fund wallet: ${w.address}`, 'Then redeploy the contract with platform=<address>'] })
      } catch (e) {
        return json({ error: (e as Error).message }, 500)
      }
    }

    // Manual trigger
    if (path === '/agent/run' && req.method === 'POST') {
      void runCycle()
      return json({ ok: true, message: 'Cycle triggered' })
    }

    // Marketplace relays (stubs — configure server-side API keys in .env)
    if (path === '/amazon/orders') return json({ orders: [], note: 'Set AMAZON_ACCESS_KEY etc. in .env and implement SigV4 here.' })
    if (path === '/ebay/orders')   return json({ orders: [], note: 'Set EBAY_CLIENT_ID etc. in .env and implement OAuth2 here.' })
    if (path === '/ebay/ping')     return new Response(null, { status: process.env.EBAY_CLIENT_ID ? 200 : 503 })
    if (path === '/jumia/orders')  return json({ orders: [], note: 'Set JUMIA_API_KEY etc. in .env.' })
    if (path === '/jumia/ping')    return new Response(null, { status: process.env.JUMIA_API_KEY ? 200 : 503 })

    return json({ error: 'Not found' }, 404)
  },
})

console.log(`[Agent] Listening on :${PORT}`)
console.log(`[Agent] Contract: ${CONTRACT_ADDRESS || '(not set)'}`)
console.log(`[Agent] Wallet:   ${AGENT_WALLET_ID || '(not set — POST /agent/setup)'}`)
console.log(`[Agent] Poll: ${POLL_MS / 1000}s | Release: ${AUTO_RELEASE_DELAY_S / 3600}h | Refund: ${AUTO_REFUND_DELAY_S / 86400}d`)

// Kick off the polling loop
void runCycle()
setInterval(() => { void runCycle() }, POLL_MS)
