import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { decideRelease, sweep, type DecideDeps, type Payer, type PayResult } from '../src/buyer/decide.ts'
import { StubOrderStore, type StubOrder } from '../src/buyer/orderStore.ts'
import type { VerifyResult } from '../src/buyer/verifyValidator.ts'

const sha = (t: string): string => createHash('sha256').update(t).digest('hex')
const order = (key: string, proof = JSON.stringify({ type: 'tracking', value: '1Z999AA10123456784', carrier: 'UPS', note: '' })): StubOrder => ({
  key, orderRef: `ord-${key}`, amountDisplay: '10 USDC (display only)', proof, status: 'Delivered',
})
const VERIFIED: VerifyResult = {
  ok: true,
  validator: { badge: 'B', tokenId: '1', owner: 'o', agentUri: 'u', metadataHash: 'h', wallet: 'w', endpoint: 'e' },
}
const REFUSED: VerifyResult = { ok: false, code: 'HASH_MISMATCH', reason: 'card does not match', retryable: false, step: '4' }

function verdictFor(o: StubOrder, orderRef: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1', verdict: 'pass', kind: 'tracking', code: 'OK', reason: 'ok', retryable: false, simulated: false,
    evidenceHash: sha(`evidence-${o.key}`), proofSha256: sha(o.proof), orderRef, ...over,
  }
}
function payerOf(answer: (o: StubOrder, ref: string, n: number) => Partial<PayResult> | Error): { payer: Payer; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    payer: {
      validate: (proof, ref) => {
        calls.push(ref ?? '')
        const o = { ...order('x'), proof }
        const a = answer(o, ref ?? '', calls.length)
        if (a instanceof Error) return Promise.reject(a)
        return Promise.resolve({ verdict: null, paymentMade: true, settlement: { transaction: 'tx1' }, refusedByBuyer: null, ...a })
      },
    },
  }
}
const deps = (payer: Payer, over: Partial<DecideDeps> = {}): DecideDeps => ({
  badge: 'B', verify: () => Promise.resolve(VERIFIED), payer, demoMode: true, delay: () => Promise.resolve(), ...over,
})
const passWith = (over: Record<string, unknown> = {}) => (o: StubOrder, ref: string): Partial<PayResult> => ({ verdict: verdictFor(o, ref, over) })

void describe('release decision: branching on the verdict', () => {
  void it('a pass releases, and records the evidence hash and the payment', async () => {
    const { payer, calls } = payerOf(passWith({ simulated: true }))
    const d = await decideRelease(order('1'), deps(payer))
    assert.equal(d.outcome, 'RELEASE_NOW')
    assert.equal(d.paidCalls, 1)
    assert.equal(d.txHash, 'tx1')
    assert.match(d.evidenceHash ?? '', /^[0-9a-f]{64}$/)
    assert.equal(calls.length, 1)
  })

  void it('a pass that rests on simulated lookups cannot release outside demo mode', async () => {
    const { payer } = payerOf(passWith({ simulated: true }))
    const d = await decideRelease(order('1'), deps(payer, { demoMode: false }))
    assert.equal(d.outcome, 'DEFER_TO_TIMER')
    assert.equal(d.code, 'SIMULATED_EVIDENCE')
  })

  void it('a real (non-simulated) pass releases outside demo mode', async () => {
    const { payer } = payerOf(passWith({ simulated: false }))
    assert.equal((await decideRelease(order('1'), deps(payer, { demoMode: false }))).outcome, 'RELEASE_NOW')
  })

  void it('a definite fail is flagged for a human, with the verdict code', async () => {
    const { payer } = payerOf(passWith({ verdict: 'fail', code: 'INVALID_FORMAT', reason: 'bad check digit' }))
    const d = await decideRelease(order('1'), deps(payer))
    assert.equal(d.outcome, 'FLAG_FOR_REVIEW')
    assert.equal(d.code, 'INVALID_FORMAT')
  })

  void it('free text is flagged and never released', async () => {
    const { payer } = payerOf(passWith({ verdict: 'fail', kind: 'text', code: 'NOT_VERIFIABLE' }))
    assert.equal((await decideRelease(order('1'), deps(payer))).outcome, 'FLAG_FOR_REVIEW')
  })

  void it('an inconclusive fail falls back to the timer and does not pay again by default', async () => {
    const { payer, calls } = payerOf(passWith({ verdict: 'fail', code: 'NOT_CONFIRMED', retryable: true }))
    const d = await decideRelease(order('1'), deps(payer))
    assert.equal(d.outcome, 'DEFER_TO_TIMER')
    assert.equal(d.code, 'INCONCLUSIVE')
    assert.equal(calls.length, 1)
  })

  void it('with one retry allowed, an inconclusive answer is retried once under a new reference and can then release', async () => {
    let waited = 0
    const { payer, calls } = payerOf((o, ref, n) => ({ verdict: verdictFor(o, ref, n === 1 ? { verdict: 'fail', code: 'NOT_CONFIRMED', retryable: true } : {}) }))
    const d = await decideRelease(order('1'), deps(payer, { maxRetries: 1, delay: () => {
      waited += 1
      return Promise.resolve()
    } }))
    assert.equal(d.outcome, 'RELEASE_NOW')
    assert.equal(d.paidCalls, 2)
    assert.deepEqual(calls, ['ord-1', 'ord-1.r1'])
    assert.equal(waited, 1)
  })
})

void describe('release decision: nothing is paid unless the validator is verified', () => {
  void it('a refused validator means the payer is never called', async () => {
    const { payer, calls } = payerOf(passWith())
    const d = await decideRelease(order('1'), deps(payer, { verify: () => Promise.resolve(REFUSED) }))
    assert.equal(d.outcome, 'DEFER_TO_TIMER')
    assert.equal(d.code, 'VALIDATOR_HASH_MISMATCH')
    assert.equal(d.validatorVerified, false)
    assert.equal(d.paidCalls, 0)
    assert.equal(calls.length, 0)
  })

  void it('the buyer payment policy refusing a payment falls back to the timer', async () => {
    const { payer } = payerOf(() => ({ paymentMade: false, refusedByBuyer: 'payee differs from the registry wallet' }))
    const d = await decideRelease(order('1'), deps(payer))
    assert.equal(d.code, 'PAYMENT_REFUSED_BY_POLICY')
    assert.equal(d.paidCalls, 0)
  })

  void it('a call that fails outright falls back to the timer', async () => {
    const { payer } = payerOf(() => new Error('socket hang up'))
    assert.equal((await decideRelease(order('1'), deps(payer))).code, 'CALL_FAILED')
  })
})

void describe('release decision: a verdict that is not believed', () => {
  for (const [label, over] of [
    ['about a different proof', { proofSha256: sha('another proof') }],
    ['echoing a different order reference', { orderRef: 'someone-else' }],
    ['with no valid evidence hash', { evidenceHash: 'nope' }],
    ['from an unknown schema version', { schemaVersion: '2' }],
  ] as const) {
    void it(`is ignored when it is ${label}`, async () => {
      const { payer } = payerOf(passWith(over))
      const d = await decideRelease(order('1'), deps(payer))
      assert.equal(d.outcome, 'DEFER_TO_TIMER')
      assert.equal(d.code, 'VERDICT_UNTRUSTED')
    })
  }
})

void describe('the stub order store and the sweep', () => {
  void it('a sweep decides each delivered order once and records the outcome', async () => {
    const store = new StubOrderStore([order('a'), order('b')], {})
    const { payer } = payerOf((o, ref) => ({ verdict: verdictFor(o, ref, ref === 'ord-b' ? { verdict: 'fail', code: 'INVALID_FORMAT' } : {}) }))
    const decisions = await sweep(store, deps(payer))
    assert.deepEqual(decisions.map((d) => d.outcome), ['RELEASE_NOW', 'FLAG_FOR_REVIEW'])
    assert.equal(store.get('a')?.status, 'Released')
    assert.equal(store.get('b')?.status, 'Flagged')
    assert.equal((await sweep(store, deps(payer))).length, 0, 'decided orders are not decided twice')
  })

  void it('refuses to exist next to the live mainnet configuration', () => {
    assert.throws(() => new StubOrderStore([], { CIRCLE_MAINNET_API_KEY: 'x' }), /live mainnet settings are present/)
    assert.throws(() => new StubOrderStore([], { VITE_MAINNET_ESCROW_CONTRACT_ADDRESS: '0x52A3' }), /live mainnet settings are present/)
  })
})
