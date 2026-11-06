import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { PaymentLedger } from '../src/payments/ledger.ts'
import type { Accounting, BeginInput } from '../src/payments/ledger.ts'

const LIMITS = { payerDailyMaxMicro: 12_000_000n, sponsorDailyBudgetMicro: 20_000_000n, estimatedSponsorFeeMicro: 4_000_000n }
const PRICE = 6_000_000n
const ACCOUNTING: Accounting = { sponsorFeeMicro: '3000000', buyerPaidMicro: '6000000', payeeReceivedMicro: '6000000', basis: 'summary-and-balances' }

let counter = 0
function input(over: Partial<BeginInput> = {}): BeginInput {
  counter += 1
  return { requestId: `pay_req${counter}`, proofSha256: `proof${counter}`, payer: 'payerA', payTo: 'payee', amountMicro: PRICE, payloadHash: `payload${counter}`, ...over }
}

void describe('one payment per request id', () => {
  void it('a second attempt while the first is in flight is refused, not charged again', () => {
    const ledger = new PaymentLedger(LIMITS)
    const first = input()
    assert.equal(ledger.begin(first).kind, 'new')
    const second = ledger.begin({ ...first, payloadHash: 'other-payload' })
    assert.equal(second.kind, 'in_flight')
    assert.equal(ledger.all().length, 1)
  })

  void it('after settlement the same payer and proof get the stored result back, with no new record', () => {
    const ledger = new PaymentLedger(LIMITS)
    const first = input()
    ledger.begin(first)
    ledger.settled(first.payloadHash, { txHash: 'tx1', accounting: ACCOUNTING, result: { verdict: 'pass' } })
    const again = ledger.begin({ ...first, payloadHash: 'fresh-payload' })
    assert.equal(again.kind, 'already_settled')
    if (again.kind === 'already_settled') assert.deepEqual(again.record.result, { verdict: 'pass' })
    assert.equal(ledger.all().length, 1)
  })

  void it('the same id with a different proof, or from a different payer, is rejected', () => {
    const ledger = new PaymentLedger(LIMITS)
    const first = input()
    ledger.begin(first)
    ledger.settled(first.payloadHash, { txHash: 'tx1', accounting: ACCOUNTING, result: {} })
    const other = ledger.begin({ ...first, payloadHash: 'p2', proofSha256: 'different' })
    assert.deepEqual(other.kind === 'rejected' && other.code, 'ID_CONFLICT')
    const stranger = ledger.begin({ ...first, payloadHash: 'p3', payer: 'payerB' })
    assert.deepEqual(stranger.kind === 'rejected' && stranger.code, 'PAYER_MISMATCH')
  })

  void it('a failed attempt may be retried with a new payment, but the failed payment stays dead', () => {
    const ledger = new PaymentLedger(LIMITS)
    const first = input()
    ledger.begin(first)
    ledger.failed(first.payloadHash, 'settlement failed')
    assert.equal(ledger.begin({ ...first, payloadHash: 'retry' }).kind, 'new')
    const dead = ledger.begin({ ...first, requestId: 'pay_other', payloadHash: first.payloadHash })
    assert.deepEqual(dead.kind === 'rejected' && dead.code, 'PAYLOAD_REPLAYED')
  })
})

void describe('replay protection', () => {
  void it('the same signed payment cannot be used for a different request', () => {
    const ledger = new PaymentLedger(LIMITS)
    const first = input()
    ledger.begin(first)
    ledger.settled(first.payloadHash, { txHash: 'tx1', accounting: ACCOUNTING, result: {} })
    const replay = ledger.begin(input({ payloadHash: first.payloadHash }))
    assert.deepEqual(replay.kind === 'rejected' && replay.code, 'PAYLOAD_REPLAYED')
  })

  void it('is remembered across a restart', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'payments.jsonl')
    const before = new PaymentLedger(LIMITS, file)
    const first = input()
    before.begin(first)
    before.settled(first.payloadHash, { txHash: 'tx1', accounting: ACCOUNTING, result: { verdict: 'pass' } })
    const after = new PaymentLedger(LIMITS, file)
    const replay = after.begin(input({ payloadHash: first.payloadHash }))
    assert.deepEqual(replay.kind === 'rejected' && replay.code, 'PAYLOAD_REPLAYED')
    assert.equal(after.begin({ ...first, payloadHash: 'new' }).kind, 'already_settled')
  })
})

void describe('spend caps', () => {
  void it('stops a payer at its daily cap', () => {
    const ledger = new PaymentLedger(LIMITS)
    assert.equal(ledger.begin(input()).kind, 'new')
    assert.equal(ledger.begin(input()).kind, 'new')
    const third = ledger.begin(input())
    assert.deepEqual(third.kind === 'rejected' && third.code, 'CAP_PAYER_DAILY')
    assert.equal(ledger.begin(input({ payer: 'payerB' })).kind, 'new')
  })

  void it('stops the sponsor at its daily fee budget, counting actual fees once known', () => {
    const ledger = new PaymentLedger({ ...LIMITS, payerDailyMaxMicro: 1_000_000_000n })
    const first = input({ payer: 'p0' })
    ledger.begin(first)
    // The real fee (9 CCD) is higher than the 4 CCD estimate, so it is the number that counts.
    ledger.settled(first.payloadHash, { txHash: 'tx', accounting: { ...ACCOUNTING, sponsorFeeMicro: '9000000' }, result: {} })
    assert.equal(ledger.begin(input({ payer: 'p1' })).kind, 'new') // 9 + 4 estimate = 13 of 20
    assert.equal(ledger.begin(input({ payer: 'p2' })).kind, 'new') // 9 + 4 + 4 = 17 of 20
    const blocked = ledger.begin(input({ payer: 'p3' })) // 17 + 4 = 21 > 20
    assert.deepEqual(blocked.kind === 'rejected' && blocked.code, 'CAP_SPONSOR_DAILY')
  })

  void it('the 24 hour window rolls: yesterday does not count', () => {
    let now = new Date('2026-11-06T10:00:00Z')
    const ledger = new PaymentLedger(LIMITS, null, () => now)
    ledger.begin(input())
    ledger.begin(input())
    assert.deepEqual((ledger.begin(input()) as { code?: string }).code, 'CAP_PAYER_DAILY')
    now = new Date('2026-11-07T10:00:01Z')
    assert.equal(ledger.begin(input()).kind, 'new')
  })
})
