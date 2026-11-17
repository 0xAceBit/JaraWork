/**
 * Checks every transaction listed in trajectory/evidence.json against the Concordium testnet, read-only.
 * No key and no account are needed:   node scripts/verify-evidence.ts
 *
 * For each hash it asks the node what the transaction really was and compares it with what the docs claim:
 * its type, who sent it, and for a payment the amount, the recipient and who paid the network fee.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TransactionHash, TransactionStatusEnum } from '@concordium/web-sdk'
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'

interface Expect { transactionType: string; sender: string; sponsor?: string; to?: string; amountMicro?: string }
interface Entry { label: string; hash: string; expect: Expect }
interface Evidence { accounts: Record<string, string>; transactions: Entry[] }

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const evidence = JSON.parse(readFileSync(join(root, 'trajectory', 'evidence.json'), 'utf8')) as Evidence
const host = process.env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com'
const port = Number(process.env.CCD_GRPC_PORT ?? 20000)
const client = new ConcordiumGRPCNodeClient(host, port, credentials.createSsl(), { timeout: 20_000 })

/** Serialises SDK objects (bigints, amounts, addresses) into plain strings so they can be compared. */
function plain(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))) as Record<string, unknown>
}
const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : JSON.stringify(v))
const short = (a: string): string => (a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a)

let failures = 0
console.log(`Checking ${evidence.transactions.length} transactions on ${host}\n`)

for (const entry of evidence.transactions) {
  const want = entry.expect
  const status = await client.getBlockItemStatus(TransactionHash.fromHexString(entry.hash))
  if (status.status !== TransactionStatusEnum.Finalized) {
    failures += 1
    console.log(`FAIL  ${entry.label}\n      not finalized on chain (status: ${status.status})\n`)
    continue
  }
  const summary = plain(status.outcome.summary)
  const sponsor = (summary.sponsor ?? {}) as Record<string, unknown>
  const transfer = (summary.transfer ?? {}) as Record<string, unknown>
  const got = {
    transactionType: str(summary.transactionType),
    sender: str(summary.sender),
    sponsor: str(sponsor.sponsor),
    to: str(transfer.to),
    amountMicro: str(transfer.amount),
  }
  const problems: string[] = []
  const account = (name: string | undefined): string | undefined => (name === undefined ? undefined : evidence.accounts[name] ?? name)
  if (got.transactionType !== want.transactionType) problems.push(`type is ${got.transactionType}, expected ${want.transactionType}`)
  if (got.sender !== account(want.sender)) problems.push(`sender is ${short(got.sender)}, expected ${want.sender}`)
  if (want.sponsor !== undefined && got.sponsor !== account(want.sponsor)) problems.push(`fee payer is ${short(got.sponsor)}, expected ${want.sponsor}`)
  if (want.to !== undefined && got.to !== account(want.to)) problems.push(`recipient is ${short(got.to)}, expected ${want.to}`)
  if (want.amountMicro !== undefined && got.amountMicro !== want.amountMicro) problems.push(`amount is ${got.amountMicro} microCCD, expected ${want.amountMicro}`)
  const ok = problems.length === 0
  if (!ok) failures += 1
  const fee = want.sponsor !== undefined ? ` fee paid by the sponsor: ${str(sponsor.cost)} microCCD (buyer fee: ${str(summary.cost)})` : ` fee: ${str(summary.cost)} microCCD`
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${entry.label}`)
  console.log(`      ${got.transactionType}, finalized, sender ${short(got.sender)}${got.to ? `, to ${short(got.to)}, ${got.amountMicro} microCCD` : ''}`)
  console.log(`     ${fee}`)
  for (const p of problems) console.log(`      PROBLEM: ${p}`)
  console.log('')
}

console.log(failures === 0 ? 'All transactions match what the docs say.' : `${failures} transaction(s) do not match.`)
process.exit(failures === 0 ? 0 : 1)
