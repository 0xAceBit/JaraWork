import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { SpendLog } from '../src/payments/spendLog.ts'

const HOUR = 60 * 60 * 1000

void describe('the buyer spend cap survives restarts', () => {
  void it('adds up what was paid in the last 24 hours', () => {
    const log = new SpendLog(null, () => 100 * HOUR)
    log.add(7_500_000n)
    log.add(7_500_000n)
    assert.equal(log.total24h(), 15_000_000n)
  })

  void it('forgets payments older than 24 hours', () => {
    let t = 0
    const log = new SpendLog(null, () => t)
    log.add(5n)
    t = 23 * HOUR
    log.add(7n)
    assert.equal(log.total24h(), 12n)
    t = 25 * HOUR
    assert.equal(log.total24h(), 7n)
  })

  void it('a restart does NOT reset it when a file is used', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'spend-')), 'spend.jsonl')
    const before = new SpendLog(file, () => 10 * HOUR)
    before.add(7_500_000n)
    before.add(7_500_000n)
    const afterRestart = new SpendLog(file, () => 11 * HOUR)
    assert.equal(afterRestart.total24h(), 15_000_000n)
  })

  void it('a memory-only log starts from zero after a restart (so choosing it is a visible decision)', () => {
    const lost = new SpendLog(null)
    assert.equal(lost.total24h(), 0n)
  })
})
