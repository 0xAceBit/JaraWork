import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStubProbes } from '../src/service/probes.ts'
import type { Probes } from '../src/service/probes.ts'
import { sha256Hex } from '../src/service/evidence.ts'
import { validateDeliveryProof } from '../src/service/validate.ts'

const NOW = (): Date => new Date('2026-11-06T10:00:00.000Z')
const proof = (type: string, value: string, carrier = '', note = ''): string => JSON.stringify({ type, value, carrier, note })
const run = (p: string, probes: Probes = createStubProbes(), orderRef?: string) =>
  validateDeliveryProof(orderRef === undefined ? { proof: p } : { proof: p, orderRef }, probes, NOW)

const CID_V0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const CID_V1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'

/** Wraps the stub probes and counts how often a (simulated) external lookup happens. */
function countingProbes(): { probes: Probes; calls: { carrier: number; link: number } } {
  const base = createStubProbes()
  const calls = { carrier: 0, link: 0 }
  const probes: Probes = {
    carrier: {
      simulated: true,
      lookup: (number, carrier) => {
        calls.carrier += 1
        return base.carrier.lookup(number, carrier)
      },
    },
    link: {
      simulated: true,
      probeUrl: (url) => {
        calls.link += 1
        return base.link.probeUrl(url)
      },
      probeCid: (cid) => {
        calls.link += 1
        return base.link.probeCid(cid)
      },
    },
  }
  return { probes, calls }
}

void describe('valid proofs', () => {
  const cases: [string, string][] = [
    ['UPS tracking number the carrier reports delivered', proof('tracking', '1Z999AA10123456784', 'UPS')],
    ['postal (S10) tracking number the carrier reports delivered', proof('tracking', 'RR123456785US', 'Other')],
    ['https link that is reachable', proof('url', 'https://example.com/proof/123')],
    ['IPFS CIDv0 that is retrievable', proof('ipfs', CID_V0)],
    ['IPFS CIDv1 that is retrievable', proof('ipfs', CID_V1)],
    ['IPFS reference with the ipfs:// prefix', proof('ipfs', `ipfs://${CID_V0}`)],
  ]
  for (const [name, p] of cases) {
    void it(`passes: ${name}`, async () => {
      const result = await run(p)
      assert.equal(result.verdict, 'pass', result.reason)
      assert.equal(result.code, 'OK')
      assert.match(result.evidenceHash, /^[0-9a-f]{64}$/)
      assert.equal(result.simulated, true, 'stubbed lookups must be labelled simulated')
      assert.ok(result.checks.length >= 2 && result.checks.every((c) => c.ok))
    })
  }

  void it('binds the verdict to the exact input and is deterministic', async () => {
    const p = proof('tracking', '1Z999AA10123456784', 'UPS')
    const a = await run(p, createStubProbes(), 'order-42')
    const b = await run(p, createStubProbes(), 'order-42')
    assert.equal(a.proofSha256, sha256Hex(p), 'proofSha256 is the hash of the exact input string')
    assert.equal(a.evidenceHash, b.evidenceHash)
    assert.equal(a.orderRef, 'order-42')
    assert.equal(a.validatedAt, '2026-11-06T10:00:00.000Z')
  })
})

void describe('invalid proofs', () => {
  void it('rejects a bad check digit and never contacts a carrier', async () => {
    const { probes, calls } = countingProbes()
    const result = await run(proof('tracking', 'RR123456784US', 'Other'), probes)
    assert.equal(result.verdict, 'fail')
    assert.equal(result.code, 'INVALID_FORMAT')
    assert.equal(calls.carrier, 0)
  })

  void it('rejects an unsafe link and never probes it', async () => {
    const { probes, calls } = countingProbes()
    for (const url of ['http://example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://user:pw@example.com/x']) {
      const result = await run(proof('url', url), probes)
      assert.equal(result.verdict, 'fail', url)
      assert.equal(result.code, 'INVALID_FORMAT', url)
    }
    assert.equal(calls.link, 0)
  })

  void it('a well formed tracking number the carrier does not know is NOT_CONFIRMED and not retryable', async () => {
    const result = await run(proof('tracking', '1Z999AA10123456785', 'UPS'))
    assert.equal(result.verdict, 'fail')
    assert.equal(result.code, 'NOT_CONFIRMED')
    assert.equal(result.retryable, false)
  })

  void it('a parcel still in transit fails but is retryable', async () => {
    const result = await run(proof('tracking', '123456789012', 'FedEx'))
    assert.equal(result.verdict, 'fail')
    assert.equal(result.code, 'NOT_CONFIRMED')
    assert.equal(result.retryable, true)
  })

  void it('a link host the probe cannot reach fails with UNREACHABLE', async () => {
    const result = await run(proof('url', 'https://nowhere.example.net/proof'))
    assert.equal(result.verdict, 'fail')
    assert.equal(result.code, 'UNREACHABLE')
  })

  void it('free text never passes, even if it claims delivery', async () => {
    for (const p of [proof('text', 'Delivered to the front desk, signed by Ada'), 'delivered, trust me']) {
      const result = await run(p)
      assert.equal(result.verdict, 'fail')
      assert.equal(result.code, 'NOT_VERIFIABLE')
      assert.equal(result.kind, 'text')
    }
  })

  void it('a lookup that throws is a retryable failure, never a pass', async () => {
    const base = createStubProbes()
    const broken: Probes = { ...base, carrier: { simulated: true, lookup: () => Promise.reject(new Error('carrier API down')) } }
    const result = await run(proof('tracking', '1Z999AA10123456784', 'UPS'), broken)
    assert.equal(result.verdict, 'fail')
    assert.equal(result.code, 'NOT_CONFIRMED')
    assert.equal(result.retryable, true)
    assert.ok(!JSON.stringify(result).includes('carrier API down'), 'internal error text must not leak')
  })
})
