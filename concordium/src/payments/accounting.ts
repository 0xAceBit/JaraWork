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

/** The fee the chain charged for a finalized transaction, or null if it cannot be read. */
export async function readSummaryCost(client: ConcordiumGRPCNodeClient, txHash: string): Promise<bigint | null> {
  const status = await client.getBlockItemStatus(TransactionHash.fromHexString(txHash))
  if (status.status !== TransactionStatusEnum.Finalized) return null
  const cost = (status.outcome.summary as unknown as { cost?: { microCcdAmount?: bigint } | bigint | string }).cost
  if (cost === undefined) return null
  if (typeof cost === 'bigint') return cost
  if (typeof cost === 'string') return BigInt(cost)
  return cost.microCcdAmount ?? null
}

export interface ReconcileInput {
  before: Balances
  after: Balances
  priceMicro: bigint
  payer: string
  payTo: string
  sponsor: string
  summaryCostMicro: bigint | null
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
