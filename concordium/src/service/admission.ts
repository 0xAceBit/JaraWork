/**
 * Who gets in, per request to /mcp. Requests are sorted into two budgets so cheap spam cannot use up the
 * budget of costly requests:
 *   unpaid          a probe or the first call of the x402 handshake: answered with a small payment request
 *   payment-bearing a call that carries a signed payment: it triggers a signature check against the node
 * Each budget has a per-client limit and its own global limit. The free preview form has a third, separate one.
 */
import type { IncomingMessage } from 'node:http'
import { clientKey } from './rateLimit.ts'
import type { RateDecision, RateLimiter } from './rateLimit.ts'

const PAYMENT_KEY = 'x402/payment'

function hasPayment(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) return false
  const params = (message as { params?: unknown }).params
  if (typeof params !== 'object' || params === null) return false
  const meta = (params as { _meta?: unknown })._meta
  return typeof meta === 'object' && meta !== null && PAYMENT_KEY in meta
}

/** True if the request body carries a payment (also checks every entry of a batch). */
export function carriesPayment(body: unknown): boolean {
  return Array.isArray(body) ? body.some(hasPayment) : hasPayment(body)
}

export interface AdmissionLimiters {
  unpaid: RateLimiter
  paid: RateLimiter
}

export function createAdmit(limiters: AdmissionLimiters, req: Pick<IncomingMessage, 'headers' | 'socket'>): (body: unknown) => RateDecision {
  const key = clientKey(req.headers, req.socket.remoteAddress)
  return (body) => (carriesPayment(body) ? limiters.paid.take(key) : limiters.unpaid.take(key))
}
