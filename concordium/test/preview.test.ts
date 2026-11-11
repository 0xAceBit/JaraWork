import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import { createAppServer } from '../server.mjs'
import { previewProof } from '../src/service/preview.ts'
import { createRateLimiter } from '../src/service/rateLimit.ts'

void describe('free format preview', () => {
  void it('accepts well-formed proofs of each kind', () => {
    assert.equal(previewProof({ type: 'tracking', value: '1Z999AA10123456784' }).formatOk, true)
    assert.equal(previewProof({ type: 'tracking', value: 'RR123456785US' }).formatOk, true)
    assert.equal(previewProof({ type: 'url', value: 'https://example.com/proof' }).formatOk, true)
    assert.equal(previewProof({ type: 'ipfs', value: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' }).formatOk, true)
  })

  void it('rejects malformed proofs with a reason', () => {
    const digit = previewProof({ type: 'tracking', value: 'RR123456784US' })
    assert.equal(digit.formatOk, false)
    assert.match(digit.reason, /check digit/i)
    assert.equal(previewProof({ type: 'url', value: 'http://example.com' }).formatOk, false)
    assert.equal(previewProof({ type: 'url', value: 'https://localhost/x' }).formatOk, false)
    assert.equal(previewProof({ type: 'ipfs', value: 'Qm-not-a-cid' }).formatOk, false)
  })

  void it('never passes free text', () => {
    const r = previewProof({ type: 'text', value: 'delivered, trust me' })
    assert.equal(r.formatOk, false)
    assert.equal(r.kind, 'text')
  })

  void it('says what it did NOT check, so it cannot be mistaken for the paid verdict', () => {
    assert.match(previewProof({ type: 'tracking', value: '1Z999AA10123456784' }).notChecked.join(' '), /carrier/i)
    assert.match(previewProof({ type: 'url', value: 'https://example.com' }).notChecked.join(' '), /responds/i)
    assert.match(previewProof({ type: 'ipfs', value: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' }).notChecked.join(' '), /retrieved/i)
  })

  void it('handles garbage input without throwing', () => {
    for (const input of [undefined, null, 5, 'x', [], {}, { type: 'banana', value: 'x' }, { type: 'url' }, { type: 'url', value: '   ' }, { type: 'url', value: 'x'.repeat(2000) }, { type: 'url', value: 'https://a.com/\u0000' }]) {
      const r = previewProof(input)
      assert.equal(r.formatOk, false)
      assert.equal(r.kind, 'unknown')
    }
  })

  void it('never echoes what was typed', () => {
    for (const type of ['tracking', 'url', 'ipfs', 'text']) {
      const r = previewProof({ type, value: `https://example.com/ZZMARKERZZ<script>${type}` })
      assert.doesNotMatch(JSON.stringify(r), /ZZMARKERZZ|<script>/)
    }
  })
})

void describe('preview route', () => {
  async function withServer<T>(limiter: ReturnType<typeof createRateLimiter> | undefined, run: (base: string) => Promise<T>): Promise<T> {
    const server = createAppServer(limiter === undefined ? {} : { limiter })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    try {
      return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
  const post = (base: string, body: string): Promise<Response> => fetch(`${base}/demo/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })

  void it('answers a valid request with the preview', async () => {
    await withServer(undefined, async (base) => {
      const res = await post(base, JSON.stringify({ type: 'tracking', value: '1Z999AA10123456784' }))
      assert.equal(res.status, 200)
      const body = (await res.json()) as { formatOk: boolean; kind: string }
      assert.deepEqual({ formatOk: body.formatOk, kind: body.kind }, { formatOk: true, kind: 'tracking' })
    })
  })

  void it('rejects broken JSON, an oversized body and the wrong method', async () => {
    await withServer(undefined, async (base) => {
      assert.equal((await post(base, '{not json')).status, 400)
      assert.equal((await post(base, JSON.stringify({ type: 'url', value: 'x'.repeat(10_000) }))).status, 413)
      assert.equal((await fetch(`${base}/demo/preview`)).status, 405)
    })
  })

  void it('is rate limited', async () => {
    await withServer(createRateLimiter({ perKeyLimit: 2, globalLimit: 100, windowMs: 60_000 }), async (base) => {
      const body = JSON.stringify({ type: 'text', value: 'x' })
      assert.equal((await post(base, body)).status, 200)
      assert.equal((await post(base, body)).status, 200)
      assert.equal((await post(base, body)).status, 429)
    })
  })
})
