/**
 * Parses the on-chain `deliveryProof` string the way the JaraWork app writes it:
 *   {"type":"tracking|url|ipfs|text","value":"...","carrier":"UPS|FedEx|USPS|DHL|Other","note":"..."}
 * Anything that is not such a JSON object is legacy free text (same rule as the app's parser).
 * `note` is untrusted free text: it is dropped here and never validated, hashed or echoed.
 */
import type { ServiceKind } from './types.ts'

export type EnvelopeType = Exclude<ServiceKind, 'unknown'>

export interface ProofEnvelope {
  type: EnvelopeType
  value: string
  /** Declared carrier, '' when none. Only meaningful for tracking proofs. */
  carrier: string
}

export type ParsedProof =
  | { ok: true; envelope: ProofEnvelope }
  | { ok: false; reason: string }

const TYPES: readonly string[] = ['tracking', 'url', 'ipfs', 'text']
const CARRIERS: readonly string[] = ['', 'UPS', 'FedEx', 'USPS', 'DHL', 'Other']

export function parseProof(proof: string): ParsedProof {
  const trimmed = proof.trim()
  let json: unknown
  try {
    json = JSON.parse(trimmed)
  } catch {
    return { ok: true, envelope: { type: 'text', value: trimmed, carrier: '' } } // legacy free text
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: true, envelope: { type: 'text', value: trimmed, carrier: '' } }
  }

  const record = json as Record<string, unknown>
  const { type, value } = record
  if (typeof type !== 'string' || !TYPES.includes(type)) {
    return { ok: false, reason: 'The proof is JSON but its type is missing or not one of tracking, url, ipfs, text.' }
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: 'The proof is JSON but its value is missing or empty.' }
  }
  const carrier = typeof record.carrier === 'string' ? record.carrier : ''
  if (!CARRIERS.includes(carrier)) {
    return { ok: false, reason: 'The declared carrier is not one of UPS, FedEx, USPS, DHL, Other.' }
  }
  return { ok: true, envelope: { type: type as EnvelopeType, value: value.trim(), carrier } }
}
