/**
 * Judge demo: the whole flow against the PUBLIC validator service on Concordium testnet.
 *
 *   node scripts/judge-demo.ts          verify the validator from the registry only (free, safe)
 *   node scripts/judge-demo.ts --pay    also run four demo orders: verify, pay over x402, get a verdict, decide
 *
 * --pay needs a funded Concordium TESTNET account of your own:
 *   CCD_PAYER_ADDRESS and CCD_PAYER_PRIVATE_KEY in concordium/.env (get test CCD from the Concordium faucet).
 * Orders live in a stub store; nothing here touches any escrow or any mainnet.
 */
import { join } from 'node:path'
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'
import { CONCORDIUM_TESTNET_CAIP2 } from '@x402/concordium'
import { hostedValidatorRegistry } from '../src/buyer/registry.ts'
import { sweep, type DecideDeps, type Payer } from '../src/buyer/decide.ts'
import { StubOrderStore } from '../src/buyer/orderStore.ts'
import { PaidLog } from '../src/buyer/paidLog.ts'
import { verifyValidator } from '../src/buyer/verifyValidator.ts'
import { readBalances } from '../src/payments/accounting.ts'
import { createBuyer } from '../src/payments/buyer.ts'
import { TESTNET_REGISTRY } from '../src/registry/types.ts'
import { checkKeyAgainstAccount } from './registry/keycheck.ts'
import { paths } from './registry/lib.ts' // also loads concordium/.env

const BADGE = process.env.VALIDATOR_BADGE ?? 'JyP9YR6Wk3YPaGx3e8zyu'
const SERVICE = process.env.SERVICE_URL ?? 'https://jarawork-agent.onrender.com/mcp'
const PAYER = process.env.CCD_PAYER_ADDRESS ?? '3HKu4eSXZBTeCmf6XV51EQ1HuBe3tDNDo1TbDcEBzPgYrRHg1V'
const SPONSOR = process.env.ALLOWED_FEE_PAYER ?? '3EZWRpdzPzi8WfsGRsiupiQEGZ6DjouZsANczD1uKEpkFL7qwc'
const PAY = process.argv.includes('--pay')

async function fetchCard(uri: string): Promise<Uint8Array> {
  if (!uri.startsWith('https://')) throw new Error('only https card URLs are fetched')
  const response = await fetch(uri, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`card HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

const verify = (badge: string) =>
  verifyValidator(badge, { registry: hostedValidatorRegistry(), trustedRegistry: TESTNET_REGISTRY, serviceUrl: SERVICE, fetchCard })

const say = (line = ''): void => console.log(line)
say('JaraWork Proof Validator: judge demo (Concordium testnet)')
say(`  service  ${SERVICE}`)
say(`  badge    ${BADGE}`)
say()

// Step 1: is this validator who it says it is? (registry, active status, card hash, endpoint, payee)
say('STEP 1  Verify the validator from the registry (nothing is paid)')
const verified = await verify(BADGE)
if (!verified.ok) {
  say(`  REFUSED  ${verified.code}: ${verified.reason}`)
  process.exit(1)
}
say(`  VERIFIED  registered agent, active, card hash matches the chain`)
say(`            endpoint the card vouches for: ${verified.validator.endpoint}`)
say(`            payee read from the registry:  ${verified.validator.wallet}`)
if (!PAY) {
  say()
  say('Verify-only run finished. Add --pay to run four demo orders (needs your own testnet account).')
  process.exit(0)
}

// Step 2: pay and decide. Needs a funded testnet account of your own.
const payerKey = (process.env.CCD_PAYER_PRIVATE_KEY ?? '').trim().replace(/^0x/i, '')
if (!/^[0-9a-fA-F]{64}$/.test(payerKey)) {
  say('\n--pay needs CCD_PAYER_PRIVATE_KEY (64 hex characters) in concordium/.env. Nothing was paid.')
  process.exit(1)
}
const chain = new ConcordiumGRPCNodeClient('grpc.testnet.concordium.com', 20000, credentials.createSsl(), { timeout: 20_000 })
if (!(await checkKeyAgainstAccount(chain, PAYER, payerKey)).belongs) {
  say(`\nThe key in CCD_PAYER_PRIVATE_KEY does not belong to ${PAYER}. Nothing was paid.`)
  process.exit(1)
}

const opened: { close: () => Promise<void> }[] = []
const policy = { network: CONCORDIUM_TESTNET_CAIP2, registryTokenAddress: BADGE, allowedFeePayer: SPONSOR, maxPerPaymentMicro: 15_000_000n, dailyMaxMicro: 150_000_000n }
const quietLog = (event: string, data: Record<string, unknown>): void => {
  if (event === 'buyer.approved') say(`          buyer approved the terms: ${String((data.terms as { amount?: string })?.amount)} microCCD to the registry wallet`)
  if (event === 'buyer.refused') say(`          buyer REFUSED to pay: ${String(data.reason)}`)
}
// The payer is created for the endpoint the verified card vouches for, on first use.
const payerFor = (endpoint: string): Payer => {
  let buyer: Awaited<ReturnType<typeof createBuyer>> | null = null
  return {
    validate: async (proof, orderRef) => {
      buyer ??= await createBuyer({ url: new URL(endpoint), payerAddress: PAYER, payerPrivateKey: payerKey, policy }, quietLog)
      if (!opened.includes(buyer)) opened.push(buyer)
      return buyer.validate(proof, orderRef)
    },
  }
}

const stamp = Date.now().toString(36)
const proof = (type: string, value: string, carrier = ''): string => JSON.stringify({ type, value, carrier, note: '' })
const store = new StubOrderStore([
  { key: 'A', orderRef: `demo-${stamp}-a`, amountDisplay: '25 USDC (display only)', proof: proof('tracking', '1Z999AA10123456784', 'UPS'), status: 'Delivered' },
  { key: 'B', orderRef: `demo-${stamp}-b`, amountDisplay: '40 USDC (display only)', proof: proof('tracking', 'RR123456784US', 'Other'), status: 'Delivered' },
  { key: 'C', orderRef: `demo-${stamp}-c`, amountDisplay: '15 USDC (display only)', proof: proof('text', 'Left it with the neighbour'), status: 'Delivered' },
  { key: 'D', orderRef: `demo-${stamp}-d`, amountDisplay: '60 USDC (display only)', proof: proof('url', 'https://example.com/'), status: 'Delivered' },
])
const expected: Record<string, string> = { A: 'release (valid UPS number)', B: 'flag (bad check digit)', C: 'flag (free text is never verified)', D: 'release (the link really responds: a REAL network check)' }
const who = [PAYER, verified.validator.wallet, SPONSOR]
const before = await readBalances(chain, who)

say('\nSTEP 2  Four delivered orders, each: re-verify, pay over x402, get a verdict, decide')
const deps: DecideDeps = { badge: BADGE, verify, payerFor, paidLog: new PaidLog(join(paths.data, 'judge-paid.jsonl')), demoMode: true }
const decisions = await sweep(store, deps)
for (const d of decisions) {
  say(`\n  Order ${d.orderKey}  expected: ${expected[d.orderKey]}`)
  say(`    decision   ${d.outcome}  (${d.code})`)
  say(`    reason     ${d.reason}`)
  say(`    evidence   ${d.evidenceHash?.slice(0, 16) ?? '-'}...   paid calls: ${d.paidCalls}   payment tx: ${d.txHash ?? '-'}`)
}

const after = await readBalances(chain, who)
const micro = (n: bigint): string => `${(Number(n) / 1_000_000).toFixed(6)} CCD`
say('\nSTEP 3  Who paid what (from the chain, testnet CCD)')
say(`  buyer paid       ${micro(before[PAYER] - after[PAYER])}   (the price, no fee)`)
say(`  validator earned ${micro(after[verified.validator.wallet] - before[verified.validator.wallet])}`)
say(`  sponsor paid     ${micro(before[SPONSOR] - after[SPONSOR])}   (the network fees)`)
say('\nNote: the carrier lookup is a simulated stub and says so. The link check (order D) is a real request to the real internet.')
for (const buyer of opened) await buyer.close()
process.exit(0)
