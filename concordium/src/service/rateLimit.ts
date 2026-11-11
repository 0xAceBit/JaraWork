/**
 * A small in-memory rate limiter for the public tool endpoint. Two windows: one per client key and one
 * global. The client key comes from a forwarded header that a caller can fake, so the global limit is the
 * backstop that faking cannot get around. State is per process and resets on restart.
 */
export type RateDecision = { ok: true } | { ok: false; retryAfterSeconds: number }

export interface RateLimiter {
  take(key: string): RateDecision
}

export interface RateLimitOptions {
  perKeyLimit: number
  globalLimit: number
  windowMs: number
  maxKeys?: number
}

export function createRateLimiter(options: RateLimitOptions, now: () => number = () => Date.now()): RateLimiter {
  const maxKeys = options.maxKeys ?? 5000
  const windows = new Map<string, { start: number; count: number }>()
  let globalWindow = { start: 0, count: 0 }

  function hit(entry: { start: number; count: number }, limit: number, time: number): { start: number; count: number; allowed: boolean } {
    const fresh = time - entry.start >= options.windowMs ? { start: time, count: 0 } : entry
    return { start: fresh.start, count: fresh.count + 1, allowed: fresh.count + 1 <= limit }
  }

  return {
    take(key) {
      const time = now()
      const g = hit(globalWindow, options.globalLimit, time)
      globalWindow = { start: g.start, count: g.count }
      if (!g.allowed) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((g.start + options.windowMs - time) / 1000)) }
      if (windows.size >= maxKeys && !windows.has(key)) {
        for (const [k, w] of windows) if (time - w.start >= options.windowMs) windows.delete(k)
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string)
      }
      const k = hit(windows.get(key) ?? { start: 0, count: 0 }, options.perKeyLimit, time)
      windows.set(key, { start: k.start, count: k.count })
      if (!k.allowed) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((k.start + options.windowMs - time) / 1000)) }
      return { ok: true }
    },
  }
}

/** The caller's address as the host's proxy reports it; fakeable, hence the global limit. */
export function clientKey(headers: Record<string, string | string[] | undefined>, remoteAddress: string | undefined): string {
  const forwarded = headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first !== undefined && first !== '' ? first.slice(0, 64) : (remoteAddress ?? 'unknown')
}
