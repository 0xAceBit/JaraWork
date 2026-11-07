import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reconcile } from '../src/payments/accounting.ts'

const PAYER = 'payer'
const PAYEE = 'payee'
const SPONSOR = 'sponsor'
const PRICE = 7_500_000n
const FEE = 4_991_315n

const before = { [PAYER]: 20_000_000_000n, [PAYEE]: 18_000_000_000n, [SPONSOR]: 1_500_000_000n }
const clean = { [PAYER]: before[PAYER] - PRICE, [PAYEE]: before[PAYEE] + PRICE, [SPONSOR]: before[SPONSOR] - FEE }
const base = { before, after: clean, priceMicro: PRICE, payer: PAYER, payTo: PAYEE, sponsor: SPONSOR }

void describe('sponsor versus buyer accounting', () => {
  void it('agrees when the chain summary and the balances tell the same story', () => {
    const result = reconcile({ ...base, summaryCostMicro: FEE, senderCostMicro: 0n })
    assert.equal(result.basis, 'summary-and-balances')
    assert.equal(result.sponsorFeeMicro, FEE.toString())
    assert.equal(result.buyerPaidMicro, PRICE.toString())
    assert.equal(result.payeeReceivedMicro, PRICE.toString())
    assert.equal(result.note, undefined)
  })

  void it('falls back to balances only, and says so, when the summary cannot be read', () => {
    const result = reconcile({ ...base, summaryCostMicro: null })
    assert.equal(result.basis, 'balances-only')
    assert.equal(result.sponsorFeeMicro, FEE.toString())
  })

  void it('flags a disagreement instead of picking a number', () => {
    const result = reconcile({ ...base, summaryCostMicro: FEE + 1n })
    assert.equal(result.basis, 'unverified')
    assert.match(result.note ?? '', /sponsor balance fell by/)
  })

  void it('flags a buyer who paid a fee, which must never happen in a sponsored payment', () => {
    const result = reconcile({ ...base, summaryCostMicro: FEE, senderCostMicro: 1n })
    assert.equal(result.basis, 'unverified')
    assert.match(result.note ?? '', /buyer paid a fee/)
  })

  void it('flags a buyer who was charged more than the price', () => {
    const result = reconcile({ ...base, after: { ...clean, [PAYER]: clean[PAYER] - 1n }, summaryCostMicro: FEE })
    assert.equal(result.basis, 'unverified')
    assert.match(result.note ?? '', /buyer balance fell by/)
  })
})
