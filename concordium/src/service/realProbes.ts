/**
 * Real link and IPFS checks. A server that fetches addresses given by strangers is an attack
 * target (SSRF), so every request is guarded:
 *   - https on port 443 only, no credentials, no IP-address URLs;
 *   - the hostname is resolved first and EVERY address must be public (nothing internal, loopback,
 *     link-local, private, multicast or reserved);
 *   - the connection is pinned to the address that was checked, so the name cannot change under us;
 *   - redirects are followed at most 3 times and each hop is checked again;
 *   - short timeouts, only headers are read (never the body), no cookies.
 * The network itself sits behind the Fetcher interface so the rules can be tested without it.
 */
import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { CidProbeResult, LinkProbe, LinkProbeResult, Probes } from './probes.ts'
import { createStubProbes } from './probes.ts'

const DENY = new BlockList()
const V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]
const V6: [string, number][] = [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
]
for (const [net, bits] of V4) DENY.addSubnet(net, bits, 'ipv4')
for (const [net, bits] of V6) DENY.addSubnet(net, bits, 'ipv6')

/** True only for an address on the public internet. Anything unparseable is treated as not public. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  // An IPv4 address written in IPv6 form (::ffff:a.b.c.d or ::ffff:hhhh:hhhh) is judged by the IPv4 address inside it.
  // (Node treats IPv4 as living inside the IPv6 ::ffff:0:0/96 range, so that range cannot simply be listed.)
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (dotted?.[1] !== undefined) return isPublicAddress(dotted[1])
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address)
  if (hex?.[1] !== undefined && hex[2] !== undefined) {
    const high = parseInt(hex[1], 16)
    const low = parseInt(hex[2], 16)
    return isPublicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  return !DENY.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

export interface HttpReply {
  status: number
  location?: string
}

export interface Fetcher {
  resolve(hostname: string): Promise<string[]>
  request(args: { address: string; hostname: string; path: string; method: 'HEAD' | 'GET'; timeoutMs: number }): Promise<HttpReply>
}

export type GuardedResult =
  | { kind: 'reply'; status: number }
  | { kind: 'blocked'; why: string }
  | { kind: 'failed'; why: 'dns_not_found' | 'timeout' | 'network' | 'too_many_redirects' }

export interface GuardOptions {
  timeoutMs?: number
  maxRedirects?: number
}

export async function guardedHead(urlText: string, io: Fetcher, options: GuardOptions = {}): Promise<GuardedResult> {
  const timeoutMs = options.timeoutMs ?? 5000
  const maxRedirects = options.maxRedirects ?? 3
  const deadline = Date.now() + timeoutMs
  let url: URL
  try {
    url = new URL(urlText)
  } catch {
    return { kind: 'blocked', why: 'not a valid address' }
  }
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (url.protocol !== 'https:') return { kind: 'blocked', why: 'only https is allowed' }
    if (url.port !== '' && url.port !== '443') return { kind: 'blocked', why: 'only port 443 is allowed' }
    if (url.username !== '' || url.password !== '') return { kind: 'blocked', why: 'credentials in the address are not allowed' }
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(hostname) !== 0) return { kind: 'blocked', why: 'an IP address is not allowed' }

    let addresses: string[]
    try {
      addresses = await io.resolve(hostname)
    } catch (error) {
      const code = (error as { code?: string }).code
      return { kind: 'failed', why: code === 'ENOTFOUND' || code === 'ENODATA' ? 'dns_not_found' : 'network' }
    }
    const pinned = addresses[0]
    if (pinned === undefined || !addresses.every(isPublicAddress)) return { kind: 'blocked', why: 'the name resolves to a non-public address' }

    const remaining = deadline - Date.now()
    if (remaining <= 0) return { kind: 'failed', why: 'timeout' }
    const path = `${url.pathname}${url.search}`
    let reply: HttpReply
    try {
      reply = await io.request({ address: pinned, hostname, path, method: 'HEAD', timeoutMs: remaining })
      if (reply.status === 405 || reply.status === 501) {
        reply = await io.request({ address: pinned, hostname, path, method: 'GET', timeoutMs: Math.max(1, deadline - Date.now()) })
      }
    } catch (error) {
      return { kind: 'failed', why: (error as { code?: string }).code === 'ETIMEDOUT' ? 'timeout' : 'network' }
    }
    if (reply.status >= 300 && reply.status < 400 && reply.location !== undefined) {
      try {
        url = new URL(reply.location, url)
      } catch {
        return { kind: 'blocked', why: 'the redirect target is not a valid address' }
      }
      continue
    }
    return { kind: 'reply', status: reply.status }
  }
  return { kind: 'failed', why: 'too_many_redirects' }
}

/** The real network. The connection goes to the address that was already checked, not to whatever the name says later. */
export function createNodeFetcher(): Fetcher {
  return {
    resolve: async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address),
    request: ({ address, hostname, path, method, timeoutMs }) =>
      new Promise<HttpReply>((resolve, reject) => {
        const family = address.includes(':') ? 6 : 4
        const req = httpsRequest(
          {
            host: hostname,
            servername: hostname,
            port: 443,
            path,
            method,
            agent: false,
            timeout: timeoutMs,
            headers: { 'user-agent': 'JaraWorkProofValidator/0.1', accept: '*/*', ...(method === 'GET' ? { range: 'bytes=0-0' } : {}) },
            // Node may ask for one address or for a list; answer in the form it asked for.
            lookup: (_host, lookupOptions, callback) => {
              if ((lookupOptions as { all?: boolean }).all === true) {
                ;(callback as unknown as (error: null, addresses: { address: string; family: number }[]) => void)(null, [{ address, family }])
              } else {
                callback(null, address, family)
              }
            },
          },
          (res) => {
            res.destroy() // only the headers matter; never read the body
            resolve({ status: res.statusCode ?? 0, ...(typeof res.headers.location === 'string' ? { location: res.headers.location } : {}) })
          },
        )
        req.on('timeout', () => req.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })))
        req.on('error', reject)
        req.end()
      }),
  }
}


function toLinkResult(result: GuardedResult): LinkProbeResult {
  if (result.kind === 'reply') {
    const { status } = result
    if (status >= 200 && status < 300) return { status: 'reachable', httpStatus: status }
    // A server error or rate limit is a temporary condition, so the buyer is told to try later.
    if (status === 429 || status >= 500) return { status: 'unavailable', httpStatus: status }
    return { status: 'unreachable', httpStatus: status }
  }
  if (result.kind === 'blocked') return { status: 'unreachable' }
  return { status: result.why === 'dns_not_found' ? 'unreachable' : 'unavailable' }
}

/**
 * Public gateways rate-limit shared server addresses (they answer 429), so retrieval is often reported as
 * "unavailable, try later". A dedicated gateway can be set with IPFS_GATEWAYS (comma-separated https URLs).
 */
export const DEFAULT_GATEWAYS: readonly string[] = ['https://ipfs.io', 'https://dweb.link', 'https://w3s.link']

/** Reads IPFS_GATEWAYS; only https gateways are accepted, anything else is ignored. */
export function gatewaysFromEnv(value: string | undefined): readonly string[] | undefined {
  const list = (value ?? '').split(',').map((entry) => entry.trim().replace(/\/+$/, '')).filter((entry) => /^https:\/\/[A-Za-z0-9.-]+$/.test(entry))
  return list.length > 0 ? list : undefined
}

export interface LinkProbeOptions extends GuardOptions {
  gateways?: readonly string[]
  /** IPFS retrieval can be slow when the content is not cached, so it gets longer than a normal link. */
  ipfsTimeoutMs?: number
}

export function createLinkProbe(io: Fetcher = createNodeFetcher(), options: LinkProbeOptions = {}): LinkProbe {
  const gateways = options.gateways ?? DEFAULT_GATEWAYS
  return {
    simulated: false,
    probeUrl: async (url) => toLinkResult(await guardedHead(url, io, options)),
    probeCid: async (cid): Promise<CidProbeResult> => {
      if (!/^[A-Za-z0-9]{10,128}$/.test(cid)) return { status: 'not_found' }
      let sawTemporary = false
      for (const gateway of gateways) {
        const result = toLinkResult(await guardedHead(`${gateway}/ipfs/${cid}`, io, { ...options, timeoutMs: options.ipfsTimeoutMs ?? 8000 }))
        if (result.status === 'reachable') return { status: 'retrievable' }
        if (result.status === 'unavailable') sawTemporary = true
      }
      // Only a definite "not there" from every gateway counts as not found; anything temporary means try again later.
      return { status: sawTemporary ? 'unavailable' : 'not_found' }
    },
  }
}

/** Real link and IPFS checks. The carrier lookup stays a labelled stub until real carrier credentials exist. */
export function createRealProbes(io?: Fetcher, options?: LinkProbeOptions): Probes {
  return { carrier: createStubProbes().carrier, link: createLinkProbe(io, options) }
}
