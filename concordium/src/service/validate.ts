/**
 * validateDeliveryProof: the logic behind the MCP tool.
 * Always returns a verdict (never throws on bad input). Reasons are fixed templates: the raw
 * proof, the `note` field and fetched content are never echoed, because callers may be LLMs.
 */
import { validateIpfsReference } from '../validator/ipfs.ts'
import { normalizeTracking, validateTracking } from '../validator/tracking.ts'
import { validateUrl } from '../validator/url.ts'
import { parseProof } from './envelope.ts'
import type { ProofEnvelope } from './envelope.ts'
import { evidenceHashFor, sha256Hex } from './evidence.ts'
import { createStubProbes } from './probes.ts'
import type { Probes } from './probes.ts'
import { MAX_PROOF_CHARS, VALIDATOR_INFO } from './types.ts'
import type { CheckRecord, ProofVerdict, ServiceKind, VerdictCode } from './types.ts'

const ORDER_REF = /^[A-Za-z0-9._:-]{1,64}$/
const SIMULATED_NOTE = ' This answer comes from a simulated lookup, not a real one.'

interface Outcome {
  kind: ServiceKind
  code: VerdictCode
  reason: string
  retryable: boolean
  checks: CheckRecord[]
}

const outcome = (kind: ServiceKind, code: VerdictCode, reason: string, checks: CheckRecord[], retryable = false): Outcome => ({
  kind, code, reason, retryable, checks,
})

const formatCheck = (ok: boolean, detected?: string): CheckRecord => ({
  name: 'format', ok, simulated: false, observed: { detected: detected ?? null },
})

/** Control characters other than JSON whitespace (tab, newline, carriage return). */
function hasBadControlChars(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if ((code < 0x20 && code !== 9 && code !== 10 && code !== 13) || code === 0x7f) return true
  }
  return false
}

function cap(text: string): string {
  return Array.from(text, (ch) => ((ch.codePointAt(0) ?? 0) < 0x20 ? ' ' : ch)).join('').slice(0, 200)
}

/** UPS numbers must be declared UPS or Other; a declared UPS must look like UPS. Other formats are ambiguous. */
function carrierMismatch(declared: string, detected: string | undefined): boolean {
  if (declared === 'UPS') return detected !== 'ups'
  if (detected === 'ups') return declared !== '' && declared !== 'Other'
  return false
}

async function examineTracking(envelope: ProofEnvelope, probes: Probes): Promise<Outcome> {
  const format = validateTracking(envelope.value)
  const formatRecord = formatCheck(format.pass, format.detail)
  if (!format.pass) return outcome('tracking', 'INVALID_FORMAT', format.reason, [formatRecord])
  if (carrierMismatch(envelope.carrier, format.detail)) {
    return outcome('tracking', 'CARRIER_MISMATCH', `The declared carrier ${envelope.carrier} does not match this tracking number's format.`, [formatRecord])
  }

  let lookup: Awaited<ReturnType<Probes['carrier']['lookup']>>
  try {
    lookup = await probes.carrier.lookup(normalizeTracking(envelope.value), envelope.carrier)
  } catch {
    lookup = { status: 'unavailable' }
  }
  const record: CheckRecord = {
    name: 'carrier_status',
    ok: lookup.status === 'delivered',
    simulated: probes.carrier.simulated,
    observed: { status: lookup.status, deliveredOn: lookup.deliveredOn ?? null },
  }
  const checks = [formatRecord, record]
  const note = probes.carrier.simulated ? SIMULATED_NOTE : ''
  if (lookup.status === 'delivered') return outcome('tracking', 'OK', `The carrier reports this parcel as delivered.${note}`, checks)
  if (lookup.status === 'in_transit') return outcome('tracking', 'NOT_CONFIRMED', `The carrier reports the parcel is not delivered yet.${note}`, checks, true)
  if (lookup.status === 'unavailable') return outcome('tracking', 'NOT_CONFIRMED', 'The carrier lookup is unavailable right now.', checks, true)
  return outcome('tracking', 'NOT_CONFIRMED', `The carrier has no record of this tracking number.${note}`, checks)
}

async function examineUrl(envelope: ProofEnvelope, probes: Probes): Promise<Outcome> {
  const format = validateUrl(envelope.value)
  const formatRecord = formatCheck(format.pass)
  if (!format.pass) return outcome('url', 'INVALID_FORMAT', format.reason, [formatRecord])

  let probe: Awaited<ReturnType<Probes['link']['probeUrl']>>
  try {
    probe = await probes.link.probeUrl(envelope.value)
  } catch {
    probe = { status: 'unavailable' }
  }
  const record: CheckRecord = {
    name: 'link_reachable',
    ok: probe.status === 'reachable',
    simulated: probes.link.simulated,
    observed: { status: probe.status, httpStatus: probe.httpStatus ?? null },
  }
  const checks = [formatRecord, record]
  const note = probes.link.simulated ? SIMULATED_NOTE : ''
  if (probe.status === 'reachable') return outcome('url', 'OK', `The link is well formed and reachable.${note}`, checks)
  if (probe.status === 'unavailable') return outcome('url', 'UNREACHABLE', 'The link check is unavailable right now.', checks, true)
  return outcome('url', 'UNREACHABLE', `The link could not be reached.${note}`, checks)
}

/** The CID part of "ipfs://CID/path" or a bare "CID/path". */
export function extractCid(reference: string): string {
  return reference.replace(/^ipfs:\/\//i, '').split(/[/?#]/)[0] ?? ''
}

async function examineIpfs(envelope: ProofEnvelope, probes: Probes): Promise<Outcome> {
  const format = validateIpfsReference(envelope.value)
  const formatRecord = formatCheck(format.pass, format.detail)
  if (!format.pass) return outcome('ipfs', 'INVALID_FORMAT', format.reason, [formatRecord])

  let probe: Awaited<ReturnType<Probes['link']['probeCid']>>
  try {
    probe = await probes.link.probeCid(extractCid(envelope.value))
  } catch {
    probe = { status: 'unavailable' }
  }
  const record: CheckRecord = {
    name: 'content_retrievable',
    ok: probe.status === 'retrievable',
    simulated: probes.link.simulated,
    observed: { status: probe.status },
  }
  const checks = [formatRecord, record]
  const note = probes.link.simulated ? SIMULATED_NOTE : ''
  if (probe.status === 'retrievable') return outcome('ipfs', 'OK', `The IPFS content is well formed and retrievable.${note}`, checks)
  if (probe.status === 'unavailable') return outcome('ipfs', 'NOT_CONFIRMED', 'The IPFS retrieval check is unavailable right now.', checks, true)
  return outcome('ipfs', 'NOT_CONFIRMED', `The IPFS content could not be retrieved.${note}`, checks)
}

function toVerdict(o: Outcome, proof: ProofEnvelope | null, proofString: string, orderRef: string | undefined, now: Date): ProofVerdict {
  return {
    schemaVersion: '1',
    verdict: o.code === 'OK' ? 'pass' : 'fail',
    kind: o.kind,
    code: o.code,
    reason: cap(o.reason),
    retryable: o.retryable,
    simulated: o.checks.some((c) => c.simulated),
    checks: o.checks,
    evidenceHash: evidenceHashFor({ kind: o.kind, proof, checks: o.checks }),
    proofSha256: sha256Hex(proofString),
    ...(orderRef === undefined ? {} : { orderRef }),
    validatedAt: now.toISOString(),
    validator: { ...VALIDATOR_INFO },
  }
}

export async function validateDeliveryProof(
  input: unknown,
  probes: Probes = createStubProbes(),
  clock: () => Date = () => new Date(),
): Promise<ProofVerdict> {
  const now = clock()
  const bad = (reason: string, proofString = '') => toVerdict(outcome('unknown', 'BAD_INPUT', reason, []), null, proofString, undefined, now)

  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : null
  const proof = record?.proof
  if (record === null || typeof proof !== 'string') return bad('The input must be an object with a string "proof".')

  const ref = record.orderRef
  if (ref !== undefined && (typeof ref !== 'string' || !ORDER_REF.test(ref))) {
    return bad('orderRef must be 1 to 64 characters from A-Z, a-z, 0-9, dot, underscore, colon or dash.', proof)
  }
  const orderRef = ref
  if (proof.trim() === '') return bad('The proof is empty.', proof)
  if (proof.length > MAX_PROOF_CHARS) return bad(`The proof is longer than ${MAX_PROOF_CHARS} characters.`, proof)
  if (hasBadControlChars(proof)) return bad('The proof contains control characters.', proof)

  const parsed = parseProof(proof)
  if (!parsed.ok) return toVerdict(outcome('unknown', 'BAD_ENVELOPE', parsed.reason, []), null, proof, orderRef, now)

  const { envelope } = parsed
  const examined =
    envelope.type === 'tracking' ? await examineTracking(envelope, probes)
    : envelope.type === 'url' ? await examineUrl(envelope, probes)
    : envelope.type === 'ipfs' ? await examineIpfs(envelope, probes)
    : outcome('text', 'NOT_VERIFIABLE', 'Free text cannot be verified by a machine. It needs a human reviewer.', [])

  return toVerdict(examined, envelope, proof, orderRef, now)
}
