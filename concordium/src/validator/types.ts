export type ProofKind = 'url' | 'ipfs' | 'tracking' | 'unknown'

/** Simple pass/fail with a human-readable reason. */
export interface ValidationResult {
  pass: boolean
  kind: ProofKind
  reason: string
  /** Optional extra context, for example the matched carrier or CID version. */
  detail?: string
}

export function pass(kind: ProofKind, reason: string, detail?: string): ValidationResult {
  return detail === undefined ? { pass: true, kind, reason } : { pass: true, kind, reason, detail }
}

export function fail(kind: ProofKind, reason: string, detail?: string): ValidationResult {
  return detail === undefined ? { pass: false, kind, reason } : { pass: false, kind, reason, detail }
}
