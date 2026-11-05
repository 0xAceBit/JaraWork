/**
 * validate_delivery_proof core. Pure and offline (step 1).
 * Accepts the free-form proof string a worker submits and returns pass/fail
 * with a reason. Reachability and carrier lookups are later steps.
 */
import { CID_PATTERN, validateIpfsReference } from './ipfs.ts'
import { validateTracking } from './tracking.ts'
import { fail, type ValidationResult } from './types.ts'
import { validateUrl } from './url.ts'

export type { ProofKind, ValidationResult } from './types.ts'

export const MAX_PROOF_LENGTH = 2048

export function validateDeliveryProof(input: unknown): ValidationResult {
  if (typeof input !== 'string') return fail('unknown', 'Proof must be a string.')

  const proof = input.trim()
  if (proof === '') return fail('unknown', 'Proof is empty.')
  if (proof.length > MAX_PROOF_LENGTH) return fail('unknown', `Proof is longer than ${MAX_PROOF_LENGTH} characters.`)
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(proof)) return fail('unknown', 'Proof contains control characters.')

  if (/^ipfs:\/\//i.test(proof)) return validateIpfsReference(proof)
  if (/^https?:\/\//i.test(proof)) return validateUrl(proof)

  const [firstSegment = ''] = proof.split('/')
  if (CID_PATTERN.test(firstSegment)) return validateIpfsReference(proof)

  // Keep the specific reason when the proof is recognisably a tracking number
  // that is wrong (for example a bad check digit); only fall through for unknown text.
  const tracking = validateTracking(proof)
  if (tracking.pass || tracking.kind === 'tracking') return tracking

  return fail('unknown', 'Proof is not a recognised URL, IPFS CID or tracking number.')
}
