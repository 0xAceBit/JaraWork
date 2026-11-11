/**
 * The free format preview behind the web form. It is NOT the paid verdict: it runs the offline format
 * rules only. No carrier lookup, no network request, no evidence hash. It never echoes the input, so a
 * visitor cannot use it to reflect text back. The paid check adds everything listed in `notChecked`.
 */
import { validateIpfsReference } from '../validator/ipfs.ts'
import { validateTracking } from '../validator/tracking.ts'
import { validateUrl } from '../validator/url.ts'

export interface PreviewResult {
  kind: 'tracking' | 'url' | 'ipfs' | 'text' | 'unknown'
  formatOk: boolean
  reason: string
  notChecked: string[]
}

const MAX_CHARS = 1024
const TYPES = ['tracking', 'url', 'ipfs', 'text'] as const

function hasControlCharacters(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

const bad = (reason: string): PreviewResult => ({ kind: 'unknown', formatOk: false, reason, notChecked: [] })

export function previewProof(input: unknown): PreviewResult {
  if (typeof input !== 'object' || input === null) return bad('Choose a proof type and enter a value.')
  const { type, value } = input as Record<string, unknown>
  if (typeof type !== 'string' || !(TYPES as readonly string[]).includes(type)) return bad('Choose a proof type: tracking, url, ipfs or text.')
  if (typeof value !== 'string' || value.trim() === '') return bad('Enter a value to check.')
  if (value.length > MAX_CHARS) return bad(`The value is longer than ${MAX_CHARS} characters.`)
  if (hasControlCharacters(value)) return bad('The value contains control characters.')

  if (type === 'text') {
    return { kind: 'text', formatOk: false, reason: 'Free text cannot be verified by a machine. It needs a human reviewer.', notChecked: [] }
  }
  if (type === 'tracking') {
    const r = validateTracking(value)
    return { kind: 'tracking', formatOk: r.pass, reason: r.reason.slice(0, 200), notChecked: ['Whether the carrier reports the parcel as delivered'] }
  }
  if (type === 'url') {
    const r = validateUrl(value)
    return { kind: 'url', formatOk: r.pass, reason: r.reason.slice(0, 200), notChecked: ['Whether the address really responds'] }
  }
  const r = validateIpfsReference(value)
  return { kind: 'ipfs', formatOk: r.pass, reason: r.reason.slice(0, 200), notChecked: ['Whether the content can really be retrieved'] }
}
