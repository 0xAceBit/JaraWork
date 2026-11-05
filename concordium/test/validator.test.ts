import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateDeliveryProof } from '../src/validator/index.ts'
import { s10CheckDigit } from '../src/validator/tracking.ts'

const CID_V0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
const CID_V1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'

function expectPass(input: unknown, kind: string) {
  const r = validateDeliveryProof(input)
  assert.equal(r.pass, true, `expected pass for ${String(input)}: ${r.reason}`)
  assert.equal(r.kind, kind)
}

function expectFail(input: unknown, kind: string, reasonPart?: string) {
  const r = validateDeliveryProof(input)
  assert.equal(r.pass, false, `expected fail for ${String(input)}`)
  assert.equal(r.kind, kind)
  if (reasonPart) assert.match(r.reason, new RegExp(reasonPart, 'i'))
}

void describe('input handling', () => {
  void it('rejects non-strings, empty and oversized input', () => {
    expectFail(42, 'unknown', 'string')
    expectFail(null, 'unknown', 'string')
    expectFail('', 'unknown', 'empty')
    expectFail('   ', 'unknown', 'empty')
    expectFail('a'.repeat(2049), 'unknown', 'longer')
  })
  void it('rejects control characters and unrecognised text', () => {
    expectFail('https://example.com/\u0000x', 'unknown', 'control')
    expectFail('delivered, trust me', 'unknown', 'not a recognised')
  })
})

void describe('url proofs', () => {
  void it('accepts a public https URL, with or without the default port', () => {
    expectPass('https://example.com/proof/123', 'url')
    expectPass('https://example.com:443/proof', 'url')
    expectPass('  https://tracking.example.co.uk/a?b=1  ', 'url')
  })
  void it('rejects http, credentials and odd ports', () => {
    expectFail('http://example.com/p', 'url', 'https')
    expectFail('https://user:pass@example.com/p', 'url', 'credentials')
    expectFail('https://example.com:8443/p', 'url', 'port')
  })
  void it('rejects local, internal and IP-literal hosts including obfuscated IPv4', () => {
    expectFail('https://localhost/p', 'url')
    expectFail('https://printer.local/p', 'url', 'internal')
    expectFail('https://intranet/p', 'url', 'domain')
    expectFail('https://127.0.0.1/p', 'url', 'IP-address')
    expectFail('https://2130706433/p', 'url', 'IP-address')
    expectFail('https://0x7f.1/p', 'url', 'IP-address')
    expectFail('https://[::1]/p', 'url', 'IP-address')
    expectFail('https://169.254.169.254/latest', 'url', 'IP-address')
  })
  void it('validates the CID inside an IPFS gateway URL', () => {
    expectPass(`https://ipfs.io/ipfs/${CID_V0}`, 'url')
    expectPass(`https://dweb.link/ipfs/${CID_V1}/proof.png`, 'url')
    expectFail('https://ipfs.io/ipfs/QmNotARealCid', 'url', 'invalid CID')
  })
})

void describe('ipfs proofs', () => {
  void it('accepts CIDv0 and CIDv1, bare or with ipfs://', () => {
    expectPass(CID_V0, 'ipfs')
    expectPass(CID_V1, 'ipfs')
    expectPass(`ipfs://${CID_V0}`, 'ipfs')
    expectPass(`ipfs://${CID_V1}/photos/1.jpg`, 'ipfs')
    expectPass(`${CID_V1}/index.html`, 'ipfs')
  })
  void it('rejects malformed CIDs', () => {
    expectFail(`${CID_V0}x`, 'unknown')
    expectFail(`ipfs://${CID_V0.slice(0, 40)}`, 'ipfs', '46')
    expectFail(`ipfs://Qm${'0'.repeat(44)}`, 'ipfs', 'base58')
    expectFail(`ipfs://${CID_V1.toUpperCase()}`, 'ipfs')
    expectFail(`ipfs://${CID_V1.slice(0, 40)}`, 'ipfs')
    expectFail('ipfs://hello', 'ipfs')
  })
})

void describe('tracking proofs', () => {
  void it('computes the UPU S10 check digit', () => {
    assert.equal(s10CheckDigit('12345678'), 5)
  })
  void it('accepts a valid S10 number, ignoring spaces and case', () => {
    expectPass('RR123456785US', 'tracking')
    expectPass('rr 1234 56785 us', 'tracking')
  })
  void it('rejects an S10 number with a bad check digit', () => {
    expectFail('RR123456784US', 'tracking', 'check digit')
  })
  void it('accepts UPS and common digit-only formats', () => {
    expectPass('1Z999AA10123456784', 'tracking')
    expectPass('123456789012', 'tracking')
    expectPass('123456789012345', 'tracking')
    expectPass('9400111899223197428490', 'tracking')
  })
  void it('rejects placeholders and unsupported lengths', () => {
    expectFail('111111111111', 'tracking', 'placeholder')
    expectFail('12345678901234', 'tracking', 'does not match')
    expectFail('ABC', 'unknown')
  })
})
