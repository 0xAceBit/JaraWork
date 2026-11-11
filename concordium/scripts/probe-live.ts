/** Runs the real link and IPFS checks against the real internet, including addresses that must be refused. */
import { createLinkProbe } from '../src/service/realProbes.ts'

const probe = createLinkProbe()
const urls: [string, string][] = [
  ['a real page', 'https://example.com/'],
  ['a real page that does not exist', 'https://example.com/definitely-not-here-404'],
  ['a name that secretly points at 127.0.0.1 (localtest.me)', 'https://localtest.me/'],
  ['the cloud metadata address', 'https://169.254.169.254/latest/meta-data/'],
  ['an internal-looking IP', 'https://10.0.0.1/'],
  ['a domain that does not exist', 'https://no-such-domain-jarawork-12345.example/'],
  ['plain http', 'http://example.com/'],
]
for (const [label, url] of urls) {
  const started = Date.now()
  const result = await probe.probeUrl(url)
  console.log(`${label.padEnd(58)} -> ${result.status}${result.httpStatus === undefined ? '' : ` (${result.httpStatus})`}  ${Date.now() - started}ms`)
}
const cids: [string, string][] = [
  ['a well-known IPFS file (v0)', 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'],
  ['a well-formed CID nobody hosts', 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy'],
]
for (const [label, cid] of cids) {
  const started = Date.now()
  const result = await probe.probeCid(cid)
  console.log(`${label.padEnd(58)} -> ${result.status}  ${Date.now() - started}ms`)
}
