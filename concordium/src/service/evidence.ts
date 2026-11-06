/**
 * The evidence hash binds a verdict to exactly what was examined:
 *   sha256( canonical JSON of { v, kind, proof: {type, value, carrier} | null, checks } )
 * `note` is not part of it (untrusted free text), and nothing time-dependent is included,
 * so the same proof and the same lookups always give the same hash and anyone holding the
 * proof can recompute it. It is NOT a signature: it proves consistency, not who produced it.
 */
import { createHash } from 'node:crypto'
import type { ProofEnvelope } from './envelope.ts'
import type { CheckRecord, ServiceKind } from './types.ts'

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** JSON with sorted object keys and no whitespace. Rejects values JSON cannot represent. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalJson: non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  throw new Error(`canonicalJson: unsupported type ${typeof value}`)
}

export function evidenceHashFor(input: { kind: ServiceKind; proof: ProofEnvelope | null; checks: CheckRecord[] }): string {
  const proof = input.proof === null ? null : { type: input.proof.type, value: input.proof.value, carrier: input.proof.carrier }
  return sha256Hex(canonicalJson({ v: 1, kind: input.kind, proof, checks: input.checks }))
}
