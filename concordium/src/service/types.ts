/** Types for the validate_delivery_proof service (response shape defined in docs/01-validator-spec.md). */

export type Verdict = 'pass' | 'fail'
export type ServiceKind = 'tracking' | 'url' | 'ipfs' | 'text' | 'unknown'

export type VerdictCode =
  | 'OK'
  | 'BAD_INPUT' // the tool input itself is malformed (type, size, characters)
  | 'BAD_ENVELOPE' // JSON proof with a missing or unknown type or value
  | 'INVALID_FORMAT' // the value does not have the shape its type requires
  | 'CARRIER_MISMATCH' // declared carrier contradicts the tracking number
  | 'NOT_CONFIRMED' // well formed, but the lookup does not confirm it
  | 'UNREACHABLE' // the link does not resolve
  | 'NOT_VERIFIABLE' // free text can never be machine verified

export type CheckName = 'format' | 'carrier_status' | 'link_reachable' | 'content_retrievable'

/** One check the validator ran. `observed` holds only deterministic, non-secret values. */
export interface CheckRecord {
  name: CheckName
  ok: boolean
  /** True when a stub answered instead of a real lookup. */
  simulated: boolean
  observed?: Record<string, string | number | boolean | null>
}

export interface ProofVerdict {
  schemaVersion: '1'
  verdict: Verdict
  kind: ServiceKind
  code: VerdictCode
  /** At most 200 characters, built from fixed templates. Never contains the raw proof. */
  reason: string
  /** True only when trying again later could change the answer (for example a parcel still in transit). */
  retryable: boolean
  /** True when any check was answered by a stub. Callers must not treat that as real evidence. */
  simulated: boolean
  checks: CheckRecord[]
  /** sha256 over the canonical evidence (see evidence.ts). Binds this verdict to what was examined. */
  evidenceHash: string
  /** sha256 of the exact proof string that was submitted. */
  proofSha256: string
  orderRef?: string
  validatedAt: string
  validator: { name: string; version: string }
}

export const VALIDATOR_INFO = { name: 'jarawork-proof-validator', version: '0.1.0' } as const
export const MAX_PROOF_CHARS = 1024
