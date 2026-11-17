import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import { createAppServer } from '../server.mjs'
import { carriesPayment } from '../src/service/admission.ts'
import { createRateLimiter } from '../src/service/rateLimit.ts'

const payment = { 'x402/payment': { x402Version: 2, payload: {} } }
const call = (meta?: Record<string, unknown>) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'validate_delivery_proof', arguments: { proof: 'x' }, ...(meta ? { _meta: meta } : {}) } })
const tight = (perKeyLimit: number, globalLimit = 1000) => createRateLimiter({ perKeyLimit, globalLimit, windowMs: 60_000 })

void describe('which requests count as payment-bearing', () => {
  void it('recognises a payment in the request metadata, also inside a batch', () => {
    assert.equal(carriesPayment(call(payment)), true)
    assert.equal(carriesPayment([call(), call(payment)]), true)
  })
  void it('treats everything else as unpaid', () => {
    for (const body of [call(), { jsonrpc: '2.0', method: 'tools/list' }, {}, null, undefined, 'x', 7, [], [call()], { params: { _meta: {} } }, { params: null }]) {
      assert.equal(carriesPayment(body), false)
    }
  })
})

void describe('separate budgets', () => {
  async function withServer<T>(options: Parameters<typeof createAppServer>[0], run: (post: (body: unknown) => Promise<number>, base: string) => Promise<T>): Promise<T> {
    const server = createAppServer(options)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const post = async (body: unknown): Promise<number> =>
      (await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-forwarded-for': '198.51.100.9' }, body: JSON.stringify(body) })).status
    try {
      return await run(post, base)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }

  void it('flooding the free preview does not touch the /mcp budget', async () => {
    await withServer({ previewLimiter: tight(1, 1) }, async (post, base) => {
      const preview = (): Promise<Response> => fetch(`${base}/demo/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"type":"text","value":"x"}' })
      assert.equal((await preview()).status, 200)
      assert.equal((await preview()).status, 429, 'the preview is limited')
      assert.notEqual(await post(call()), 429, 'but /mcp is not')
    })
  })

  void it('exhausting the unpaid budget leaves the payment-bearing budget alone', async () => {
    await withServer({ limiter: tight(1), paidLimiter: tight(5) }, async (post) => {
      assert.notEqual(await post(call()), 429)
      assert.equal(await post(call()), 429, 'unpaid spam is limited')
      assert.notEqual(await post(call(payment)), 429, 'a payment-bearing request still gets in')
    })
  })

  void it('exhausting the payment-bearing budget leaves unpaid requests alone', async () => {
    await withServer({ limiter: tight(5), paidLimiter: tight(1) }, async (post) => {
      assert.notEqual(await post(call(payment)), 429)
      assert.equal(await post(call(payment)), 429, 'payment-bearing spam is limited')
      assert.notEqual(await post(call()), 429, 'an unpaid request (the x402 handshake) still gets in')
    })
  })

  void it('a body that cannot be read still counts against the unpaid budget', async () => {
    await withServer({ limiter: tight(1) }, async (_post, base) => {
      const bad = (): Promise<Response> => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' }, body: '{nope' })
      assert.equal((await bad()).status, 400)
      assert.equal((await bad()).status, 429)
    })
  })

  void it('even a flood from many pretended clients cannot exceed the payment-bearing global limit', async () => {
    await withServer({ paidLimiter: tight(100, 3) }, async (_post, base) => {
      const statuses: number[] = []
      for (let i = 0; i < 6; i += 1) {
        const res = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-forwarded-for': `203.0.113.${i + 1}` }, body: JSON.stringify(call(payment)) })
        statuses.push(res.status)
      }
      assert.deepEqual(statuses.map((s) => s === 429), [false, false, false, true, true, true])
    })
  })
})
