/**
 * The escrow release decision, ported to a Node buyer.
 *   1. verifyValidator(badge): if anything is wrong, refuse and pay NOTHING.
 *   2. Only then pay over x402 and call validate_delivery_proof.
 *   3. Branch the release decision on the verdict.
 * The validator can only speed a release up or flag it. Whenever it cannot be trusted or reached,
 * the order falls back to today's timer, so the validator can never make an outcome worse.
 */
import { createHash } from 'node:crypto'
import { parseProof } from '../service/envelope.ts'
import { evidenceHashFor } from '../service/evidence.ts'
import { paidKey, type PaidLog } from './paidLog.ts'
import type { StubOrder, StubOrderStore } from './orderStore.ts'
import type { VerifiedValidator, VerifyResult } from './verifyValidator.ts'

export type Outcome = 'RELEASE_NOW' | 'FLAG_FOR_REVIEW' | 'DEFER_TO_TIMER'

export interface Decision {
  orderKey: string
  outcome: Outcome
  code: string
  reason: string
  /** True once the validator passed every check. */
  validatorVerified: boolean
  /** How many paid calls were made for this decision. */
  paidCalls: number
  evidenceHash?: string
  txHash?: string
}

/** What the buyer needs from the x402 client; the real one is createBuyer(...). */
export interface PayResult {
  verdict: Record<string, unknown> | null
  paymentMade: boolean
  settlement: Record<string, unknown> | null
  refusedByBuyer: string | null
}
export interface Payer {
  validate(proof: string, orderRef?: string): Promise<PayResult>
}

export interface DecideDeps {
  badge: string
  verify: (badge: string) => Promise<VerifyResult>
  /**
   * Builds the payer for ONE endpoint. It is called with the endpoint the verified card vouches for,
   * so the buyer can only ever pay the service it just verified.
   */
  payerFor: (endpoint: string) => Payer
  /** The buyer's memory of what it already paid for; stops a restart from paying twice. */
  paidLog?: PaidLog
  /** Simulated evidence (stubbed carrier lookups) may release only in demo mode. */
  demoMode: boolean
  /** Extra paid attempts for an inconclusive answer. Each one is a new payment, so the default is 0. */
  maxRetries?: number
  delay?: (ms: number) => Promise<void>
  log?: (event: string, data: Record<string, unknown>) => void
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

/** The answer is only believed if it is about the proof we sent. */
function integrityProblem(verdict: Record<string, unknown>, order: StubOrder, orderRef: string): string | null {
  if (verdict.schemaVersion !== '1') return 'unknown schema version'
  if (verdict.verdict !== 'pass' && verdict.verdict !== 'fail') return 'verdict is neither pass nor fail'
  if (verdict.proofSha256 !== sha256(order.proof)) return 'the answer is about a different proof than the one sent'
  if (verdict.orderRef !== orderRef) return 'the answer echoes a different order reference'
  if (typeof verdict.evidenceHash !== 'string' || !/^[0-9a-f]{64}$/.test(verdict.evidenceHash)) return 'no valid evidence hash'
  // Recompute the hash from the proof we hold and the checks the validator reports. This proves the verdict is
  // consistent with its own evidence and with our proof. It does not prove the observations were true (verdicts are unsigned).
  if (!Array.isArray(verdict.checks) || typeof verdict.kind !== 'string') return 'the verdict carries no checks to verify'
  const parsed = parseProof(order.proof)
  const proof = verdict.code === 'BAD_INPUT' || !parsed.ok ? null : parsed.envelope
  let expected: string
  try {
    expected = evidenceHashFor({ kind: verdict.kind as never, proof, checks: verdict.checks as never })
  } catch {
    return 'the checks could not be hashed'
  }
  if (expected !== verdict.evidenceHash) return 'the evidence hash does not match the proof and checks reported'
  return null
}

export async function decideRelease(order: StubOrder, deps: DecideDeps): Promise<Decision> {
  const log = deps.log ?? (() => undefined)
  const base = { orderKey: order.key, validatorVerified: false, paidCalls: 0 }
  const defer = (code: string, reason: string, extra: Partial<Decision> = {}): Decision => ({ ...base, outcome: 'DEFER_TO_TIMER', code, reason, ...extra })

  // 1. Verify the validator. Anything wrong here means no payment and the existing timer decides.
  const verified = await deps.verify(deps.badge)
  if (!verified.ok) {
    log('buyer.validator_refused', { order: order.key, code: verified.code, step: verified.step, reason: verified.reason })
    return defer(`VALIDATOR_${verified.code}`, verified.reason)
  }
  const validator: VerifiedValidator = verified.validator
  const payer = deps.payerFor(validator.endpoint)
  log('buyer.validator_verified', { order: order.key, tokenId: validator.tokenId, payee: validator.wallet })

  // 2 and 3. Pay and call; branch on the verdict.
  const maxRetries = deps.maxRetries ?? 0
  let paidCalls = 0
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const orderRef = attempt === 0 ? order.orderRef : `${order.orderRef}.r${attempt}`
    const key = paidKey(orderRef, order.proof)
    if (deps.paidLog?.get(key) === 'answered') {
      return { ...base, validatorVerified: true, paidCalls, outcome: 'DEFER_TO_TIMER', code: 'ALREADY_PAID', reason: 'An answer was already received and paid for this request, so it will not be paid for again.' }
    }
    const result = await payer.validate(order.proof, orderRef).catch((error: unknown) => {
      log('buyer.call_failed', { order: order.key, error: String(error).slice(0, 200) })
      return null
    })
    if (result?.paymentMade === true) {
      paidCalls += 1
      deps.paidLog?.set(key, 'paid')
    }
    const state = { ...base, validatorVerified: true, paidCalls }

    if (result === null) return { ...state, outcome: 'DEFER_TO_TIMER', code: 'CALL_FAILED', reason: 'The paid call failed before any verdict came back.' }
    if (result.refusedByBuyer !== null) {
      log('buyer.payment_refused', { order: order.key, reason: result.refusedByBuyer })
      return { ...state, outcome: 'DEFER_TO_TIMER', code: 'PAYMENT_REFUSED_BY_POLICY', reason: result.refusedByBuyer }
    }
    const txHash = typeof result.settlement?.transaction === 'string' ? result.settlement.transaction : undefined
    if (result.verdict === null) {
      return { ...state, outcome: 'DEFER_TO_TIMER', code: 'NO_VERDICT', reason: 'No verdict came back.', ...(txHash ? { txHash } : {}) }
    }
    const problem = integrityProblem(result.verdict, order, orderRef)
    if (problem !== null) {
      log('buyer.verdict_untrusted', { order: order.key, problem })
      return { ...state, outcome: 'DEFER_TO_TIMER', code: 'VERDICT_UNTRUSTED', reason: `The verdict was not believed: ${problem}.`, ...(txHash ? { txHash } : {}) }
    }

    const verdict = result.verdict
    if (result.paymentMade || deps.paidLog?.get(key) === 'paid') deps.paidLog?.set(key, 'answered')
    const evidenceHash = verdict.evidenceHash as string
    const reason = typeof verdict.reason === 'string' ? verdict.reason : ''
    const extra = { evidenceHash, ...(txHash ? { txHash } : {}) }

    if (verdict.verdict === 'pass') {
      if (verdict.simulated === true && !deps.demoMode) {
        return { ...state, ...extra, outcome: 'DEFER_TO_TIMER', code: 'SIMULATED_EVIDENCE', reason: 'The pass rests on simulated lookups, which cannot release funds outside demo mode.' }
      }
      return { ...state, ...extra, outcome: 'RELEASE_NOW', code: 'VALIDATED', reason }
    }
    // A failed verdict.
    if (verdict.retryable === true && attempt < maxRetries) {
      await (deps.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))))(5_000)
      continue
    }
    if (verdict.retryable === true) {
      return { ...state, ...extra, outcome: 'DEFER_TO_TIMER', code: 'INCONCLUSIVE', reason: `The check was inconclusive (${String(verdict.code)}). ${reason}` }
    }
    return { ...state, ...extra, outcome: 'FLAG_FOR_REVIEW', code: String(verdict.code), reason }
  }
  return defer('INCONCLUSIVE', 'The check stayed inconclusive.', { validatorVerified: true, paidCalls })
}

/** Decide every delivered order once and record the outcome in the store. */
export async function sweep(store: StubOrderStore, deps: DecideDeps): Promise<Decision[]> {
  const decisions: Decision[] = []
  for (const order of store.delivered()) {
    const decision = await decideRelease(order, deps)
    const note = `${decision.code}: ${decision.reason}`
    if (decision.outcome === 'RELEASE_NOW') store.release(order.key, note)
    else if (decision.outcome === 'FLAG_FOR_REVIEW') store.flag(order.key, note)
    else store.defer(order.key, note)
    decisions.push(decision)
  }
  return decisions
}
