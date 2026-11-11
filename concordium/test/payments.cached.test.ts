import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { authorizeCachedResult, type CachedRequest } from '../src/payments/cachedReplay.ts'
import { isNonAnswer } from '../src/payments/chargeability.ts'
import type { PaymentRecord } from '../src/payments/ledger.ts'

const PAYER = '3HKu4eSXZBTeCmf6XV51EQ1HuBe3tDNDo1TbDcEBzPgYrRHg1V'
const settled = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  requestId: 'pay_1', proofSha256: 'aa', payer: PAYER, payTo: 'x', amountMicro: '1', payloadHash: 'h',
  status: 'settled', createdAt: 't', updatedAt: 't', txHash: 'tx', result: { verdict: 'pass' }, ...over,
})
function request(over: Partial<CachedRequest> = {}): { req: CachedRequest } {
  return {
    req: {
      prior: settled(), proofSha256: 'aa', attached: { any: 'payload' },
      verify: () => Promise.resolve({ isValid: true, payer: PAYER }),
      senderOf: () => PAYER,
      claim: () => true,
      ...over,
    },
  }
}

void describe('serving a stored verdict to a retrying buyer (F1)', () => {
  void it('serves it when the attached payment verifies, names the original payer and is unused', async () => {
    const r = request()
    const d = await authorizeCachedResult(r.req)
    assert.equal(d.serve, true)
  })

  void it('a FORGED payment that only names the payer is refused, because verification fails', async () => {
    let claimed = false
    const r = request({ verify: () => Promise.resolve({ isValid: false }), claim: () => {
      claimed = true
      return true
    } })
    const d = await authorizeCachedResult(r.req)
    assert.deepEqual(d, { serve: false, why: 'the attached payment is not valid' })
    assert.equal(claimed, false, 'a forged payment must not even be claimed')
  })

  void it('refuses a valid payment from a different payer', async () => {
    const r = request({ verify: () => Promise.resolve({ isValid: true, payer: 'someone-else' }) })
    assert.equal((await authorizeCachedResult(r.req)).serve, false)
  })

  void it('refuses when verification throws', async () => {
    const r = request({ verify: () => Promise.reject(new Error('node down')) })
    assert.equal((await authorizeCachedResult(r.req)).serve, false)
  })

  void it('refuses a payment that was already used to fetch the verdict', async () => {
    const r = request({ claim: () => false })
    assert.deepEqual(await authorizeCachedResult(r.req), { serve: false, why: 'the attached payment was already used' })
  })

  void it('refuses when nothing is attached, the proof differs, or the earlier payment is not settled', async () => {
    assert.equal((await authorizeCachedResult(request({ attached: undefined }).req)).serve, false)
    assert.equal((await authorizeCachedResult(request({ proofSha256: 'bb' }).req)).serve, false)
    assert.equal((await authorizeCachedResult(request({ prior: settled({ status: 'verified' }) }).req)).serve, false)
    assert.equal((await authorizeCachedResult(request({ prior: undefined }).req)).serve, false)
  })
})

void describe('which results are charged (F5)', () => {
  const v = (over: Record<string, unknown>): Record<string, unknown> => ({ verdict: 'fail', code: 'X', retryable: false, ...over })
  void it('malformed input is not charged', () => assert.equal(isNonAnswer(v({ code: 'BAD_INPUT' })), true))
  void it('an inconclusive (retryable) failure is not charged', () => assert.equal(isNonAnswer(v({ code: 'NOT_CONFIRMED', retryable: true })), true))
  void it('a pass is charged', () => assert.equal(isNonAnswer(v({ verdict: 'pass', code: 'OK' })), false))
  void it('a definite failure is charged', () => {
    for (const code of ['INVALID_FORMAT', 'NOT_VERIFIABLE', 'CARRIER_MISMATCH', 'BAD_ENVELOPE', 'NOT_CONFIRMED']) {
      assert.equal(isNonAnswer(v({ code })), false, code)
    }
  })
  void it('anything that is not a verdict object is not treated as a non-answer', () => {
    for (const x of [null, undefined, 'x', 3, []]) assert.equal(isNonAnswer(x), false)
  })
})
