/**
 * URL validation, offline. Only checks that the URL is well formed and safe to
 * fetch later (https, public hostname, no credentials). It does NOT fetch the
 * URL: reachability is a separate step.
 */
import { validateCid } from './ipfs.ts'
import { fail, pass, type ValidationResult } from './types.ts'

const MAX_URL_LENGTH = 2048
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp']

export function validateUrl(raw: string): ValidationResult {
  if (raw.length > MAX_URL_LENGTH) return fail('url', `URL is longer than ${MAX_URL_LENGTH} characters.`)

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return fail('url', 'Not a valid URL.')
  }

  if (url.protocol !== 'https:') return fail('url', 'Only https URLs are accepted as delivery proof.')
  if (url.username !== '' || url.password !== '') return fail('url', 'URLs containing credentials are not accepted.')
  if (url.port !== '' && url.port !== '443') return fail('url', 'Only the default https port is accepted.')

  const host = url.hostname.toLowerCase()
  // Hosts are normalised by the URL parser, so decimal/hex IPv4 forms arrive as dotted quads.
  if (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return fail('url', 'IP-address URLs are not accepted as delivery proof.')
  }
  if (host === 'localhost' || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return fail('url', 'Local or internal hostnames are not accepted.')
  }
  if (!/\.([a-z]{2,}|xn--[a-z0-9-]+)$/.test(host)) {
    return fail('url', 'Hostname must be a public domain name.')
  }

  const gatewayMatch = /^\/ipfs\/([^/]+)/.exec(url.pathname)
  if (gatewayMatch) {
    const cid = validateCid(gatewayMatch[1])
    if (!cid.pass) return fail('url', `IPFS gateway URL has an invalid CID: ${cid.reason}`)
    return pass('url', `Well-formed https IPFS gateway URL on ${host}. Reachability not checked.`, 'ipfs-gateway')
  }

  return pass('url', `Well-formed https URL on ${host}. Reachability not checked.`)
}
