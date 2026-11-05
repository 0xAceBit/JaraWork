/**
 * IPFS content identifier (CID) validation. Offline: checks structure only,
 * it does not check that the content exists on the network.
 * Supported: CIDv0 (base58btc, sha2-256) and CIDv1 (base32 lowercase, sha2-256).
 */
import { fail, pass, type ValidationResult } from './types.ts'

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const B32 = 'abcdefghijklmnopqrstuvwxyz234567'
const SHA2_256_CODE = 0x12
const SHA2_256_LENGTH = 32

export function base58Decode(input: string): Uint8Array | null {
  let n = 0n
  for (const ch of input) {
    const i = B58.indexOf(ch)
    if (i < 0) return null
    n = n * 58n + BigInt(i)
  }
  const bytes: number[] = []
  while (n > 0n) {
    bytes.push(Number(n & 0xffn))
    n >>= 8n
  }
  for (const ch of input) {
    if (ch !== '1') break
    bytes.push(0)
  }
  return Uint8Array.from(bytes.reverse())
}

/** RFC 4648 base32, lowercase, no padding. Rejects non-zero trailing bits. */
export function base32Decode(input: string): Uint8Array | null {
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const ch of input) {
    const i = B32.indexOf(ch)
    if (i < 0) return null
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
      value &= (1 << bits) - 1
    }
  }
  if (bits > 0 && value !== 0) return null
  return Uint8Array.from(out)
}

/** Unsigned LEB128 varint. Returns [value, nextOffset] or null. */
function readVarint(bytes: Uint8Array, offset: number): [number, number] | null {
  let result = 0
  let shift = 0
  for (let i = offset; i < bytes.length && shift <= 28; i++) {
    const byte = bytes[i]
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return [result >>> 0, i + 1]
    shift += 7
  }
  return null
}

export const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/

export function validateCid(cid: string): ValidationResult {
  if (cid.startsWith('Qm')) {
    if (cid.length !== 46) return fail('ipfs', 'CIDv0 must be exactly 46 characters.')
    const bytes = base58Decode(cid)
    if (!bytes) return fail('ipfs', 'CIDv0 contains characters that are not valid base58.')
    if (bytes.length !== 34 || bytes[0] !== SHA2_256_CODE || bytes[1] !== SHA2_256_LENGTH) {
      return fail('ipfs', 'CIDv0 does not decode to a sha2-256 multihash.')
    }
    return pass('ipfs', 'Valid CIDv0 (sha2-256). Content availability not checked.', 'cid-v0')
  }
  if (cid.startsWith('b')) {
    const bytes = base32Decode(cid.slice(1))
    if (!bytes) return fail('ipfs', 'CIDv1 is not valid lowercase base32.')
    const version = readVarint(bytes, 0)
    if (!version || version[0] !== 1) return fail('ipfs', 'CIDv1 must start with version 1.')
    const codec = readVarint(bytes, version[1])
    if (!codec) return fail('ipfs', 'CIDv1 is missing a content codec.')
    const hashCode = readVarint(bytes, codec[1])
    if (!hashCode) return fail('ipfs', 'CIDv1 is missing a multihash.')
    const hashLen = readVarint(bytes, hashCode[1])
    if (!hashLen) return fail('ipfs', 'CIDv1 multihash has no length.')
    const digestLength = bytes.length - hashLen[1]
    if (digestLength !== hashLen[0]) return fail('ipfs', 'CIDv1 digest length does not match its multihash header.')
    if (hashCode[0] !== SHA2_256_CODE || hashLen[0] !== SHA2_256_LENGTH) {
      return fail('ipfs', 'Only sha2-256 CIDs are accepted as delivery proof.')
    }
    return pass('ipfs', 'Valid CIDv1 (sha2-256). Content availability not checked.', 'cid-v1')
  }
  return fail('ipfs', 'Not a recognised CID (expected CIDv0 starting with Qm or CIDv1 starting with b).')
}

/** Accepts ipfs://<cid>[/path] or a bare <cid>[/path]. */
export function validateIpfsReference(raw: string): ValidationResult {
  const withoutScheme = raw.replace(/^ipfs:\/\//i, '')
  const [cid = ''] = withoutScheme.split('/')
  return validateCid(cid)
}
