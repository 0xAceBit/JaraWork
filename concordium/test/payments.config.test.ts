import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import { createAppServer } from '../server.mjs'
import { resolveServiceMode } from '../src/payments/config.ts'

const KEY = 'ab'.repeat(32)
const PAID_OK = { CCD_FACILITATOR_PRIVATE_KEY: KEY, X402_ALLOW_EPHEMERAL_LEDGER: 'true' }

void describe('service mode: paid by default and fail closed (F2)', () => {
  void it('with nothing configured the service is CLOSED, never free', () => {
    const m = resolveServiceMode({})
    assert.equal(m.mode, 'closed')
  })

  void it('free verdicts need X402_MODE=free on purpose', () => {
    assert.equal(resolveServiceMode({ X402_MODE: 'free' }).mode, 'free')
    assert.equal(resolveServiceMode({ X402_MODE: ' FREE ' }).mode, 'free')
  })

  void it('the old flag X402_ENABLED no longer decides anything', () => {
    assert.equal(resolveServiceMode({ X402_ENABLED: 'false' }).mode, 'closed')
  })

  void it('an unknown mode value closes the service', () => {
    assert.equal(resolveServiceMode({ ...PAID_OK, X402_MODE: 'frree' }).mode, 'closed')
  })

  void it('a missing or malformed key closes the service, and the reason never contains the key', () => {
    for (const bad of [undefined, '', 'not-hex', 'ab'.repeat(31)]) {
      const m = resolveServiceMode({ CCD_FACILITATOR_PRIVATE_KEY: bad, X402_ALLOW_EPHEMERAL_LEDGER: 'true' })
      assert.equal(m.mode, 'closed')
      if (m.mode === 'closed') assert.doesNotMatch(m.reason, /abab|not-hex/)
    }
  })

  void it('a valid paid setup is paid', () => {
    const m = resolveServiceMode(PAID_OK)
    assert.equal(m.mode, 'paid')
    if (m.mode === 'paid') assert.equal(m.config.priceMicro, 7_500_000n)
  })
})

void describe('ledger durability must be declared (F3)', () => {
  void it('a paid setup that does not declare where the ledger lives is closed', () => {
    const m = resolveServiceMode({ CCD_FACILITATOR_PRIVATE_KEY: KEY })
    assert.equal(m.mode, 'closed')
    if (m.mode === 'closed') assert.match(m.reason, /ledger/i)
  })

  void it('accepting an ephemeral ledger is explicit and shows up as not durable', () => {
    const m = resolveServiceMode(PAID_OK)
    assert.equal(m.mode === 'paid' && m.config.ledgerDurable, false)
  })

  void it('declaring durable storage is recorded', () => {
    const m = resolveServiceMode({ CCD_FACILITATOR_PRIVATE_KEY: KEY, X402_LEDGER_DURABLE: 'true' })
    assert.equal(m.mode === 'paid' && m.config.ledgerDurable, true)
  })

  void it('the ledger always has a file path by default, so it is never silently memory-only', () => {
    const m = resolveServiceMode(PAID_OK)
    assert.equal(m.mode === 'paid' && m.config.ledgerFile, '.data/payments.jsonl')
  })
})

void describe('a closed server refuses the tool and says so', () => {
  void it('POST /mcp answers 503 and /x402/status explains', async () => {
    const server = createAppServer({ closedReason: 'test reason' })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      const mcp = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' })
      assert.equal(mcp.status, 503)
      const status = (await (await fetch(`${base}/x402/status`)).json()) as Record<string, unknown>
      assert.deepEqual(status, { enabled: false, mode: 'closed', reason: 'test reason' })
      assert.equal((await fetch(`${base}/health`)).status, 200, 'health and the card stay up so the badge keeps working')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
