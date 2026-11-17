import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { releaseGate } from '../src/buyer/releasePolicy.ts'

const check = (name: string, simulated: boolean, ok = true) => ({ name, ok, simulated })
const gate = (checks: unknown, demoMode = false, acceptAvailabilityEvidence = false) => releaseGate({ checks }, { demoMode, acceptAvailabilityEvidence })

void describe('what evidence may release funds', () => {
  void it('a REAL carrier confirmation releases, in any mode', () => {
    for (const demoMode of [false, true]) {
      assert.deepEqual(gate([check('format', false), check('carrier_status', false)], demoMode), { release: true })
    }
  })

  void it('a SIMULATED carrier confirmation releases in demo mode only', () => {
    const checks = [check('format', false), check('carrier_status', true)]
    assert.deepEqual(gate(checks, true), { release: true })
    const refused = gate(checks, false)
    assert.equal(refused.release, false)
    assert.equal(refused.release === false && refused.code, 'SIMULATED_EVIDENCE')
  })

  void it('a link that merely responds does NOT release, even in demo mode', () => {
    for (const demoMode of [false, true]) {
      const r = gate([check('format', false), check('link_reachable', false)], demoMode)
      assert.equal(r.release, false)
      assert.equal(r.release === false && r.code, 'AVAILABILITY_ONLY')
    }
  })

  void it('an IPFS file that can be retrieved does NOT release', () => {
    const r = gate([check('format', false), check('content_retrievable', false)])
    assert.equal(r.release === false && r.code, 'AVAILABILITY_ONLY')
  })

  void it('a format-only pass does NOT release', () => {
    assert.equal(gate([check('format', false)]).release, false)
  })

  void it('availability evidence releases only when the operator explicitly accepts it', () => {
    const checks = [check('format', false), check('link_reachable', false)]
    assert.deepEqual(gate(checks, false, true), { release: true })
  })

  void it('but even then a simulated availability pass cannot release outside demo mode', () => {
    const r = gate([check('format', false), check('link_reachable', true)], false, true)
    assert.equal(r.release === false && r.code, 'SIMULATED_EVIDENCE')
  })

  void it('a check that did not pass counts for nothing', () => {
    const r = gate([check('format', false), check('carrier_status', false, false)])
    assert.equal(r.release, false)
  })

  void it('garbage in the checks never releases', () => {
    for (const checks of [undefined, null, 'x', 5, {}, [null], [{}], [{ name: 5, ok: true }]]) {
      assert.equal(gate(checks).release, false)
    }
  })
})
