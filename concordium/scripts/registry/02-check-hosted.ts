/**
 * Step 2: fetch the card from its public URL and hash the bytes the server
 * ACTUALLY serves, then compare with the hash we expect.
 *
 * Usage: node scripts/registry/02-check-hosted.ts [--wait] [--url <url>] [--expect <sha256>]
 *   --wait   keep polling every 15 s for up to 10 minutes (use after a deploy)
 * Read-only. Exit code 0 only when the served bytes match.
 */
import { cardUrl, flagValue, hasFlag, readState, sha256Hex, show } from './lib.ts'

const url = flagValue('--url') ?? readState().agentUri ?? cardUrl()
const expected = flagValue('--expect') ?? readState().cardSha256
const SHOWN_HEADERS = ['content-type', 'content-encoding', 'content-length', 'cache-control', 'etag', 'server', 'via']

async function fetchOnce() {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
  const body = Buffer.from(await res.arrayBuffer())
  const headers: Record<string, string> = {}
  for (const name of SHOWN_HEADERS) {
    const value = res.headers.get(name)
    if (value) headers[name] = value
  }
  return { url, finalUrl: res.url, status: res.status, headers, bytes: body.length, servedSha256: sha256Hex(body) }
}

const deadline = Date.now() + 10 * 60_000
let attempt = 0
for (;;) {
  attempt += 1
  let outcome: Awaited<ReturnType<typeof fetchOnce>> | { error: string }
  try {
    outcome = await fetchOnce()
  } catch (err) {
    outcome = { error: err instanceof Error ? err.message : String(err) }
  }
  const matches = 'servedSha256' in outcome && outcome.status === 200 && outcome.servedSha256 === expected
  show(`ATTEMPT ${attempt}`, { ...outcome, expectedSha256: expected ?? '(none in state)', matches })
  if (matches) {
    console.log('\nServed bytes match the expected hash.')
    process.exit(0)
  }
  if (!hasFlag('--wait') || Date.now() > deadline) {
    console.log('\nServed bytes do NOT match (or the card is not live yet).')
    process.exit(1)
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000))
}
