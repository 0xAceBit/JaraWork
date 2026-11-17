import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FreebieLimiter } from '../src/payments/freebies.ts'

void describe('uncharged-answer allowance per payer', () => {
  void it('allows up to the limit, then refuses that payer', () => {
    const f = new FreebieLimiter(3, 60_000, () => 0)
    for (let i = 0; i < 3; i += 1) {
      assert.equal(f.tooMany('a'), false)
      f.record('a')
    }
    assert.equal(f.tooMany('a'), true)
  })

  void it('counts each payer on its own', () => {
    const f = new FreebieLimiter(1, 60_000, () => 0)
    f.record('a')
    assert.equal(f.tooMany('a'), true)
    assert.equal(f.tooMany('b'), false)
  })

  void it('forgives after the window passes', () => {
    let t = 0
    const f = new FreebieLimiter(1, 1000, () => t)
    f.record('a')
    assert.equal(f.tooMany('a'), true)
    t = 1001
    assert.equal(f.tooMany('a'), false)
  })

  void it('stays bounded when many payers appear', () => {
    const f = new FreebieLimiter(1, 60_000, () => 0)
    for (let i = 0; i < 6000; i += 1) f.record(`p${i}`)
    f.record('last')
    assert.equal(f.tooMany('last'), true)
  })
})
