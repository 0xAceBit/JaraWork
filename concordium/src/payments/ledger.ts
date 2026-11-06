/**
 * Payment ledger: one payment per request id, replay protection, spend caps, and a record of
 * who paid what. Append-only JSONL when a file is given (in memory otherwise). No network access.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface Accounting {
  /** Fee the sponsor paid, in microCCD, per chain evidence. */
  sponsorFeeMicro: string
  /** What left the buyer's account, in microCCD. Should equal the price. */
  buyerPaidMicro: string
  /** What the payee received, in microCCD. */
  payeeReceivedMicro: string
  /** How the numbers were obtained; 'unverified' when sources disagree. */
  basis: 'summary-and-balances' | 'summary-only' | 'balances-only' | 'unverified'
  note?: string
}

export interface PaymentRecord {
  requestId: string
  proofSha256: string
  orderRef?: string
  payer: string
  payTo: string
  amountMicro: string
  payloadHash: string
  status: 'verified' | 'settled' | 'failed'
  createdAt: string
  updatedAt: string
  txHash?: string
  accounting?: Accounting
  /** The verdict returned to the buyer, kept so a retry gets it back without a second charge. */
  result?: unknown
  failure?: string
}

export type RejectCode = 'PAYLOAD_REPLAYED' | 'ID_CONFLICT' | 'PAYER_MISMATCH' | 'CAP_PAYER_DAILY' | 'CAP_SPONSOR_DAILY'

export type BeginOutcome =
  | { kind: 'new'; record: PaymentRecord }
  | { kind: 'already_settled'; record: PaymentRecord }
  | { kind: 'in_flight'; record: PaymentRecord }
  | { kind: 'rejected'; code: RejectCode; reason: string }

export interface BeginInput {
  requestId: string
  proofSha256: string
  orderRef?: string
  payer: string
  payTo: string
  amountMicro: bigint
  payloadHash: string
}

export interface LedgerLimits {
  payerDailyMaxMicro: bigint
  sponsorDailyBudgetMicro: bigint
  estimatedSponsorFeeMicro: bigint
}

const DAY_MS = 24 * 60 * 60 * 1000

export class PaymentLedger {
  private readonly records: PaymentRecord[] = []
  private readonly latestById = new Map<string, PaymentRecord>()
  private readonly payloads = new Set<string>()
  private readonly limits: LedgerLimits
  private readonly file: string | null
  private readonly now: () => Date

  constructor(limits: LedgerLimits, file: string | null = null, now: () => Date = () => new Date()) {
    this.limits = limits
    this.file = file
    this.now = now
    if (file !== null && existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') continue
        this.apply(JSON.parse(line) as PaymentRecord)
      }
    }
  }

  private apply(record: PaymentRecord): void {
    const index = this.records.findIndex((r) => r.payloadHash === record.payloadHash)
    if (index >= 0) this.records[index] = record
    else this.records.push(record)
    this.latestById.set(record.requestId, record)
    this.payloads.add(record.payloadHash)
  }

  private save(record: PaymentRecord): void {
    this.apply(record)
    if (this.file === null) return
    mkdirSync(dirname(this.file), { recursive: true })
    appendFileSync(this.file, `${JSON.stringify(record)}\n`)
  }

  private recent(): PaymentRecord[] {
    const since = this.now().getTime() - DAY_MS
    return this.records.filter((r) => r.status !== 'failed' && Date.parse(r.createdAt) >= since)
  }

  begin(input: BeginInput): BeginOutcome {
    if (this.payloads.has(input.payloadHash)) {
      return { kind: 'rejected', code: 'PAYLOAD_REPLAYED', reason: 'This signed payment was already presented. Create a new payment.' }
    }
    const existing = this.latestById.get(input.requestId)
    if (existing && existing.status !== 'failed') {
      if (existing.proofSha256 !== input.proofSha256) {
        return { kind: 'rejected', code: 'ID_CONFLICT', reason: 'This request id was already used for a different proof.' }
      }
      if (existing.payer !== input.payer) {
        return { kind: 'rejected', code: 'PAYER_MISMATCH', reason: 'This request id belongs to a different payer.' }
      }
      return { kind: existing.status === 'settled' ? 'already_settled' : 'in_flight', record: existing }
    }
    const recent = this.recent()
    const payerTotal = recent.filter((r) => r.payer === input.payer).reduce((sum, r) => sum + BigInt(r.amountMicro), 0n)
    if (payerTotal + input.amountMicro > this.limits.payerDailyMaxMicro) {
      return { kind: 'rejected', code: 'CAP_PAYER_DAILY', reason: 'The payer reached its daily spend cap.' }
    }
    const sponsorTotal = recent.reduce((sum, r) => sum + BigInt(r.accounting?.sponsorFeeMicro ?? this.limits.estimatedSponsorFeeMicro), 0n)
    if (sponsorTotal + this.limits.estimatedSponsorFeeMicro > this.limits.sponsorDailyBudgetMicro) {
      return { kind: 'rejected', code: 'CAP_SPONSOR_DAILY', reason: 'The sponsor reached its daily fee budget.' }
    }
    const stamp = this.now().toISOString()
    const record: PaymentRecord = {
      requestId: input.requestId,
      proofSha256: input.proofSha256,
      ...(input.orderRef === undefined ? {} : { orderRef: input.orderRef }),
      payer: input.payer,
      payTo: input.payTo,
      amountMicro: input.amountMicro.toString(),
      payloadHash: input.payloadHash,
      status: 'verified',
      createdAt: stamp,
      updatedAt: stamp,
    }
    this.save(record)
    return { kind: 'new', record }
  }

  settled(payloadHash: string, update: { txHash: string; accounting: Accounting; result: unknown }): PaymentRecord {
    return this.update(payloadHash, { status: 'settled', ...update })
  }

  failed(payloadHash: string, failure: string): PaymentRecord {
    return this.update(payloadHash, { status: 'failed', failure })
  }

  private update(payloadHash: string, patch: Partial<PaymentRecord>): PaymentRecord {
    const current = this.records.find((r) => r.payloadHash === payloadHash)
    if (!current) throw new Error('Unknown payment.')
    const next = { ...current, ...patch, updatedAt: this.now().toISOString() }
    this.save(next)
    return next
  }

  all(): PaymentRecord[] {
    return [...this.records]
  }
}
