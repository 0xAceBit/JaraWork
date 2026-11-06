/**
 * The request id is derived by the SERVER from the tool arguments, never chosen by the client:
 * "pay_" + first 32 hex of sha256("<orderRef>:<proofSha256>"), or of the proof hash alone.
 * So one (order, proof) pair maps to exactly one payment, and a client cannot dodge the rule
 * by inventing a fresh id. The format matches the x402 payment-identifier pattern (16 to 128
 * characters of letters, digits, hyphen and underscore).
 */
import { sha256Hex } from '../service/evidence.ts'

export interface RequestFacts {
  requestId: string
  proofSha256: string
  orderRef?: string
}

export function describeRequest(args: Record<string, unknown>): RequestFacts {
  const proof = typeof args.proof === 'string' ? args.proof : ''
  const orderRef = typeof args.orderRef === 'string' && args.orderRef !== '' ? args.orderRef : undefined
  const proofSha256 = sha256Hex(proof)
  const seed = orderRef === undefined ? proofSha256 : `${orderRef}:${proofSha256}`
  return {
    requestId: `pay_${sha256Hex(seed).slice(0, 32)}`,
    proofSha256,
    ...(orderRef === undefined ? {} : { orderRef }),
  }
}
