/**
 * End-to-end x402 test on Concordium testnet: real server, real buyer, real sponsored payments.
 * SPENDS testnet CCD (the buyer pays the price, the sponsor pays fees). Log: trajectory/x402/.
 * Usage: node scripts/x402-e2e.ts
 */
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'
import { createAppServer } from '../server.mjs'
import { readBalances } from '../src/payments/accounting.ts'
import { createBuyer } from '../src/payments/buyer.ts'
import type { BuyerPolicy } from '../src/payments/buyer.ts'
import { loadPaymentsConfig } from '../src/payments/config.ts'
import { createPaymentContext } from '../src/payments/paymentContext.ts'
import { checkKeyAgainstAccount } from './registry/keycheck.ts'
import { config as chainConfig, paths } from './registry/lib.ts'

const PAYER = process.env.CCD_PAYER_ADDRESS ?? '3HKu4eSXZBTeCmf6XV51EQ1HuBe3tDNDo1TbDcEBzPgYrRHg1V'
const payerKey = (process.env.CCD_PAYER_PRIVATE_KEY ?? '').trim().replace(/^0x/i, '')
const logDir = join(paths.root, 'trajectory', 'x402')
const ledgerFile = join(paths.data, 'e2e-ledger.jsonl')
mkdirSync(logDir, { recursive: true })
rmSync(ledgerFile, { force: true })
const logFile = join(logDir, `e2e-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)

const log = (event: string, data: Record<string, unknown> = {}): void => {
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...data }, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))
  console.log(line)
  appendFileSync(logFile, `${line}\n`)
}
let failures = 0
const expect = (ok: boolean, what: string, detail: unknown = ''): void => {
  log(ok ? 'PASS' : 'FAIL', { what, detail })
  if (!ok) failures += 1
}
const proof = (type: string, value: string, carrier = ''): string => JSON.stringify({ type, value, carrier, note: '' })

process.env.X402_ENABLED = 'true'
process.env.X402_LEDGER_FILE = ledgerFile
process.env.PAYER_DAILY_MAX_MICRO = '12000000' // two payments of 6 CCD, so the third must hit the cap
const cfg = loadPaymentsConfig()
if (cfg === null || !/^[0-9a-fA-F]{64}$/.test(payerKey)) throw new Error('Missing sponsor or payer key in concordium/.env.')

const chain = new ConcordiumGRPCNodeClient(cfg.grpcHost, cfg.grpcPort, credentials.createSsl(), { timeout: 20_000 })
// Preflight: a wrong key must STOP the run before any money can move.
for (const [name, account, key] of [
  ['payer', PAYER, payerKey],
  ['sponsor', cfg.facilitatorAddress, cfg.facilitatorPrivateKey],
] as const) {
  const check = await checkKeyAgainstAccount(chain, account, key)
  log(check.belongs ? 'PASS' : 'ABORT', { what: `${name} key belongs to ${account}`, derivedPublicKey: check.derivedPublicKey, onChainPublicKeys: check.onChainKeys })
  if (!check.belongs) process.exit(2)
}

const payments = await createPaymentContext(cfg, chain, log)
if (payments.payTo === PAYER) {
  log('ABORT', { what: 'the payer and the payee are the same account' })
  process.exit(2)
}
const who = [PAYER, payments.payTo, cfg.facilitatorAddress]
const before = await readBalances(chain, who)
log('balances.before', { payer: before[PAYER], payee: before[payments.payTo], sponsor: before[cfg.facilitatorAddress] })

const server = createAppServer({ wrap: payments.wrap, paymentStatus: payments.status })
await new Promise<void>((resolve) => server.listen(0, resolve))
const url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`)

const policy: BuyerPolicy = {
  network: cfg.network,
  registryTokenAddress: cfg.registryTokenAddress,
  allowedFeePayer: cfg.facilitatorAddress,
  maxPerPaymentMicro: cfg.priceMicro * 2n,
  dailyMaxMicro: 1_000_000_000n,
}
let capturedPaid: string | null = null
const capturingFetch: typeof fetch = async (input, init) => {
  if (typeof init?.body === 'string' && init.body.includes('x402/payment')) capturedPaid = init.body
  return fetch(input, init)
}
const open = (over: Partial<BuyerPolicy> = {}, capture = false) =>
  createBuyer({ url, payerAddress: PAYER, payerPrivateKey: payerKey, policy: { ...policy, ...over }, ...(capture ? { fetch: capturingFetch } : {}) }, log)

// 1. Hostile buyer policies: each must refuse BEFORE any money moves.
for (const [name, over] of [
  ['price above the per-payment cap', { maxPerPaymentMicro: 1_000_000n }],
  ['server payee differs from the registry wallet', { registryTokenAddress: 'JyP9TtQC3HCNrTYR3sc2T' }],
  ['fee payer is not the allowed sponsor', { allowedFeePayer: PAYER }],
] as const) {
  const buyer = await open(over)
  const result = await buyer.validate(proof('tracking', '1Z999AA10123456784', 'UPS'))
  expect(result.refusedByBuyer !== null && !result.paymentMade, `buyer refuses: ${name}`, result.refusedByBuyer)
  await buyer.close()
}
const afterRefusals = await readBalances(chain, who)
expect(afterRefusals[PAYER] === before[PAYER], 'no money moved during the refusals')

// 2. Honest buyer: paid call #1, retry (no second charge), paid call #2, third call over the cap.
const buyer = await open({}, true)
const first = await buyer.validate(proof('tracking', '1Z999AA10123456784', 'UPS'), 'order-1')
expect(first.paymentMade && first.verdict?.verdict === 'pass', 'paid call 1: verdict returned after settlement', first.settlement)
expect(payments.ledger.all().filter((r) => r.status === 'settled').length === 1, 'ledger holds one settled payment')

const retry = await buyer.validate(proof('tracking', '1Z999AA10123456784', 'UPS'), 'order-1')
expect(retry.verdict?.evidenceHash === first.verdict?.evidenceHash, 'retry returns the stored verdict')
expect(payments.ledger.all().length === 1, 'retry created no second payment')

const second = await buyer.validate(proof('url', 'https://example.com/proof/42'), 'order-2')
expect(second.paymentMade && second.verdict?.verdict === 'pass', 'paid call 2 settled', second.settlement)
const paidBody = capturedPaid

const third = await buyer.validate(proof('ipfs', 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'), 'order-3')
expect(third.verdict === null && payments.ledger.all().length === 2, 'third payment refused by the payer daily cap, nothing charged', third.isError)

// 3. Replay: present the already used signed payment again for a different proof.
if (paidBody !== null) {
  const forged = JSON.parse(paidBody) as { params: { arguments: { proof: string } } }
  forged.params.arguments.proof = proof('url', 'https://example.org/other')
  const replay = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(forged) })
  const replayText = await replay.text()
  expect(!replayText.includes('"verdict":"pass"') && payments.ledger.all().length === 2, 'replayed signed payment gets no verdict and no new payment')
}
await buyer.close()

// 4. Reconcile: what the sponsor paid versus what the buyer paid.
const after = await readBalances(chain, who)
const settled = payments.ledger.all().filter((r) => r.status === 'settled')
const sponsorFees = settled.reduce((sum, r) => sum + BigInt(r.accounting?.sponsorFeeMicro ?? '0'), 0n)
const buyerPaid = settled.reduce((sum, r) => sum + BigInt(r.accounting?.buyerPaidMicro ?? '0'), 0n)
const summary = {
  payments: settled.map((r) => ({ requestId: r.requestId, txHash: r.txHash, accounting: r.accounting })),
  totals: { buyerPaidMicro: buyerPaid, sponsorFeesMicro: sponsorFees, payerBalanceChange: after[PAYER] - before[PAYER], sponsorBalanceChange: after[cfg.facilitatorAddress] - before[cfg.facilitatorAddress] },
}
log('accounting.summary', summary)
expect(settled.length === 2 && settled.every((r) => r.accounting?.basis === 'summary-and-balances'), 'every payment reconciles: summary cost equals the sponsor balance change', settled.map((r) => r.accounting?.basis))
expect(buyerPaid === cfg.priceMicro * 2n && after[PAYER] - before[PAYER] === -buyerPaid, 'the buyer paid exactly the price and no fee')
expect(sponsorFees > 0n && after[cfg.facilitatorAddress] - before[cfg.facilitatorAddress] === -sponsorFees, 'the sponsor paid the fees')

writeFileSync(`${logFile}.summary.json`, JSON.stringify(summary, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v), 2))
log('done', { failures, logFile, network: chainConfig.network })
server.close()
process.exit(failures === 0 ? 0 : 1)
