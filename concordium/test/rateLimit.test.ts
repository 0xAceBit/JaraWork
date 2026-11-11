import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clientKey, createRateLimiter } from '../src/service/rateLimit.ts'

void describe('rate limiter', () => {
  const options = { perKeyLimit: 3, globalLimit: 5, windowMs: 60_000 }

  void it('allows up to the per-client limit, then says when to retry', () => {
    let t = 0
    const limiter = createRateLimiter(options, () => t)
    for (let i = 0; i < 3; i += 1) assert.deepEqual(limiter.take('a'), { ok: true })
    t = 10_000
    assert.deepEqual(limiter.take('a'), { ok: false, retryAfterSeconds: 50 })
  })

  void it('limits each client separately', () => {
    const limiter = createRateLimiter(options, () => 0)
    for (let i = 0; i < 3; i += 1) limiter.take('a')
    assert.equal(limiter.take('a').ok, false)
    assert.equal(limiter.take('b').ok, true)
  })

  void it('the global limit holds even when every request pretends to be a new client', () => {
    const limiter = createRateLimiter(options, () => 0)
    const results = Array.from({ length: 8 }, (_v, i) => limiter.take(`fake-${i}`).ok)
    assert.deepEqual(results, [true, true, true, true, true, false, false, false])
  })

  void it('starts a fresh window after the time is up', () => {
    let t = 0
    const limiter = createRateLimiter(options, () => t)
    for (let i = 0; i < 3; i += 1) limiter.take('a')
    assert.equal(limiter.take('a').ok, false)
    t = 60_000
    assert.equal(limiter.take('a').ok, true)
  })

  void it('does not grow without bound', () => {
    const limiter = createRateLimiter({ perKeyLimit: 1, globalLimit: 1_000_000, windowMs: 60_000, maxKeys: 50 }, () => 0)
    for (let i = 0; i < 500; i += 1) limiter.take(`k${i}`)
    assert.equal(limiter.take('another').ok, true)
  })

  void it('reads the client from the forwarded header, first entry, and bounds its length', () => {
    assert.equal(clientKey({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, '10.0.0.1'), '203.0.113.9')
    assert.equal(clientKey({}, '10.0.0.1'), '10.0.0.1')
    assert.equal(clientKey({ 'x-forwarded-for': 'x'.repeat(500) }, undefined).length, 64)
  })
})

void describe('rate limit on the tool endpoint', () => {
  void it('answers 429 with Retry-After once a client is over its limit, and leaves other routes alone', async () => {
    const { createAppServer } = await import('../server.mjs')
    const server = createAppServer({ limiter: createRateLimiter({ perKeyLimit: 2, globalLimit: 100, windowMs: 60_000 }) })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
    const post = (): Promise<Response> => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' }, body: '{}' })
    try {
      assert.notEqual((await post()).status, 429)
      assert.notEqual((await post()).status, 429)
      const blocked = await post()
      assert.equal(blocked.status, 429)
      assert.ok(Number(blocked.headers.get('retry-after')) >= 1)
      assert.equal((await fetch(`${base}/health`)).status, 200, 'other routes are not limited')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
