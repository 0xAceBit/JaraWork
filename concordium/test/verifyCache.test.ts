import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cachedVerifier } from '../src/buyer/verifyCache.ts'
import type { VerifyResult } from '../src/buyer/verifyValidator.ts'

const OK: VerifyResult = { ok: true, validator: { badge: 'B', tokenId: '1', owner: 'o', agentUri: 'u', metadataHash: 'h', wallet: 'w', endpoint: 'e' } }
const NO: VerifyResult = { ok: false, code: 'REGISTRY_UNAVAILABLE', reason: 'down', retryable: true, step: '1' }

function counting(results: VerifyResult[]): { verify: (b: string) => Promise<VerifyResult>; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    verify: (badge) => {
      calls.push(badge)
      return Promise.resolve(results[Math.min(calls.length - 1, results.length - 1)] ?? NO)
    },
  }
}

void describe('verification cache', () => {
  void it('does one lookup for many orders inside the window', async () => {
    const c = counting([OK])
    const verify = cachedVerifier(c.verify, { now: () => 0 })
    for (let i = 0; i < 5; i += 1) assert.equal((await verify('B')).ok, true)
    assert.equal(c.calls.length, 1)
  })

  void it('looks again once the window is over', async () => {
    let t = 0
    const c = counting([OK])
    const verify = cachedVerifier(c.verify, { ttlMs: 1000, now: () => t })
    await verify('B')
    t = 1001
    await verify('B')
    assert.equal(c.calls.length, 2)
  })

  void it('never caches a failure', async () => {
    const c = counting([NO, OK])
    const verify = cachedVerifier(c.verify, { now: () => 0 })
    assert.equal((await verify('B')).ok, false)
    assert.equal((await verify('B')).ok, true)
    assert.equal(c.calls.length, 2)
  })

  void it('shares one lookup between simultaneous requests', async () => {
    const c = counting([OK])
    const verify = cachedVerifier(c.verify, { now: () => 0 })
    await Promise.all([verify('B'), verify('B'), verify('B')])
    assert.equal(c.calls.length, 1)
  })

  void it('keeps separate badges separate', async () => {
    const c = counting([OK])
    const verify = cachedVerifier(c.verify, { now: () => 0 })
    await verify('A')
    await verify('B')
    assert.deepEqual(c.calls, ['A', 'B'])
  })
})
