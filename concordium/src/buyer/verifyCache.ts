/**
 * Remembers a SUCCESSFUL validator verification for a short time, so a batch of orders does not
 * repeat six registry calls each (and trip the hosted registry's rate limit). Failures are never
 * cached, concurrent requests share one lookup, and the payment itself still re-checks the payee.
 * Trade-off: a validator revoked inside the window can still be paid until it expires (default 5 minutes).
 */
import type { VerifyResult } from './verifyValidator.ts'

export interface VerifyCacheOptions {
  ttlMs?: number
  now?: () => number
}

export function cachedVerifier(verify: (badge: string) => Promise<VerifyResult>, options: VerifyCacheOptions = {}): (badge: string) => Promise<VerifyResult> {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000
  const now = options.now ?? (() => Date.now())
  const good = new Map<string, { result: VerifyResult; expires: number }>()
  const inFlight = new Map<string, Promise<VerifyResult>>()

  return (badge) => {
    const hit = good.get(badge)
    if (hit !== undefined && hit.expires > now()) return Promise.resolve(hit.result)
    const running = inFlight.get(badge)
    if (running !== undefined) return running
    const started = verify(badge)
      .then((result) => {
        if (result.ok) good.set(badge, { result, expires: now() + ttlMs })
        return result
      })
      .finally(() => {
        inFlight.delete(badge)
      })
    inFlight.set(badge, started)
    return started
  }
}
