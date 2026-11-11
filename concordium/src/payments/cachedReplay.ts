/**
 * Decides whether a stored verdict may be handed back to a retrying buyer without a second charge.
 * The attached payment is NOT trusted by its contents: it must pass a real signature check, it must
 * name the payer who originally paid, and it may be used for this only once.
 */
import type { PaymentRecord } from './ledger.ts'

export interface VerifyOutcome {
  isValid: boolean
  payer?: string
}

export type CachedDecision = { serve: true; record: PaymentRecord } | { serve: false; why: string }

export interface CachedRequest {
  prior: PaymentRecord | undefined
  proofSha256: string
  attached: unknown
  /** Runs the facilitator's verification (signature, expiry, nonce, balance) on the attached payment. */
  verify: (attached: unknown) => Promise<VerifyOutcome>
  senderOf: (attached: unknown) => string
  /** Marks the attached payment as used; false if it had been used before. */
  claim: (attached: unknown) => boolean
}

export async function authorizeCachedResult(req: CachedRequest): Promise<CachedDecision> {
  const { prior } = req
  if (prior?.status !== 'settled') return { serve: false, why: 'no settled payment for this request' }
  if (prior.proofSha256 !== req.proofSha256) return { serve: false, why: 'the proof differs from the one paid for' }
  if (req.attached === undefined) return { serve: false, why: 'no payment attached' }
  let outcome: VerifyOutcome
  try {
    outcome = await req.verify(req.attached)
  } catch {
    return { serve: false, why: 'the attached payment could not be verified' }
  }
  if (!outcome.isValid) return { serve: false, why: 'the attached payment is not valid' }
  const payer = outcome.payer ?? req.senderOf(req.attached)
  if (payer !== prior.payer) return { serve: false, why: 'the attached payment is from a different payer' }
  if (!req.claim(req.attached)) return { serve: false, why: 'the attached payment was already used' }
  return { serve: true, record: prior }
}
