/**
 * Who paid what for one settled payment, from chain evidence only.
 * Two independent sources are cross-checked: the transaction summary (cost) and the
 * before/after balances of buyer, payee and sponsor. If they disagree the record says
 * 'unverified' instead of picking one.
 */
import { AccountAddress, TransactionHash, TransactionStatusEnum } from '@concordium/web-sdk'
import type { ConcordiumGRPCNodeClient } from '@concordium/web-sdk/nodejs'
import type { Accounting } from './ledger.ts'

export type Balances = Record<string, bigint>

export async function readBalances(client: ConcordiumGRPCNodeClient, addresses: string[]): Promise<Balances> {
  const out: Balances = {}
  for (const address of addresses) {
    const info = await client.getAccountInfo(AccountAddress.fromBase58(address))
    out[address] = info.accountAmount.microCcdAmount
  }
  return out
}

/** The SDK returns fee amounts as amount objects; read the microCCD value explicitly. */
function toMicro(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return BigInt(value)
  const micro = (value as { microCcdAmount?: unknown } | null | undefined)?.microCcdAmount
  return typeof micro === 'bigint' ? micro : null
}

/**
 * The fees the chain recorded for a finalized sponsored transaction. In the block summary, `cost` is what
 * the SENDER paid (0 when sponsored) and `sponsor.cost` is what the SPONSOR paid. Null if unreadable.
 */
export async function readSummaryCosts(
  client: ConcordiumGRPCNodeClient,
  txHash: string,
): Promise<{ senderMicro: bigint; sponsorMicro: bigint } | null> {
  // Right after settlement the node can still report the transaction as merely committed, so wait briefly.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await client.getBlockItemStatus(TransactionHash.fromHexString(txHash))
    if (status.status === TransactionStatusEnum.Finalized) {
      const summary = status.outcome.summary as unknown as { cost?: unknown; sponsor?: { cost?: unknown } }
      const sender = toMicro(summary.cost)
      const sponsor = toMicro(summary.sponsor?.cost)
      return sender === null || sponsor === null ? null : { senderMicro: sender, sponsorMicro: sponsor }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return null
}

export interface ReconcileInput {
  before: Balances
  after: Balances
  priceMicro: bigint
  payer: string
  payTo: string
  sponsor: string
  summaryCostMicro: bigint | null
  /** What the chain says the buyer paid in fees. Must be 0 for a sponsored payment. */
  senderCostMicro?: bigint | null
}

export function reconcile(input: ReconcileInput): Accounting {
  const { before, after, payer, payTo, sponsor } = input
  const delta = (who: string): bigint => (after[who] ?? 0n) - (before[who] ?? 0n)
  const buyerPaid = -delta(payer)
  const payeeReceived = delta(payTo)
  const sponsorFee = -delta(sponsor)
  const problems: string[] = []
  if (buyerPaid !== input.priceMicro) problems.push(`buyer balance fell by ${buyerPaid}, price was ${input.priceMicro}`)
  if (payeeReceived !== input.priceMicro) problems.push(`payee balance rose by ${payeeReceived}, price was ${input.priceMicro}`)
  if (input.summaryCostMicro !== null && sponsorFee !== input.summaryCostMicro) {
    problems.push(`sponsor balance fell by ${sponsorFee} but the transaction summary says cost ${input.summaryCostMicro}`)
  }
  if (input.senderCostMicro !== undefined && input.senderCostMicro !== null && input.senderCostMicro !== 0n) {
    problems.push(`the transaction summary says the buyer paid a fee of ${input.senderCostMicro}`)
  }
  const basis: Accounting['basis'] =
    problems.length > 0 ? 'unverified' : input.summaryCostMicro === null ? 'balances-only' : 'summary-and-balances'
  return {
    sponsorFeeMicro: (input.summaryCostMicro ?? sponsorFee).toString(),
    buyerPaidMicro: buyerPaid.toString(),
    payeeReceivedMicro: payeeReceived.toString(),
    basis,
    ...(problems.length > 0 ? { note: problems.join('; ') } : {}),
  }
}
