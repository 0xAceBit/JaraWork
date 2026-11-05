/**
 * Step 3: ask the registry for a sign-ready `register` payload. No keys involved.
 * Safety check first: the public URL must already serve the exact card bytes,
 * otherwise we would pin a hash for a card nobody can fetch.
 *
 * Usage: node scripts/registry/03-build-register.ts [--skip-hosting-check]
 * Output: .data/register-payload.json (input for 04-sign-submit.ts)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { callTool, config, hasFlag, paths, readState, sha256Hex, show } from './lib.ts'

const state = readState()
if (!state.agentUri || !state.cardSha256) throw new Error('Run 01-build-card.ts first.')
if (state.tokenId) throw new Error(`Already registered as token ${state.tokenId}. Nothing to do.`)

if (!hasFlag('--skip-hosting-check')) {
  const res = await fetch(state.agentUri, { headers: { 'cache-control': 'no-cache' } })
  const served = sha256Hex(Buffer.from(await res.arrayBuffer()))
  show('HOSTING CHECK', { url: state.agentUri, status: res.status, servedSha256: served, expectedSha256: state.cardSha256 })
  if (res.status !== 200 || served !== state.cardSha256) {
    console.error('\nThe public URL does not serve the expected bytes yet. Push the card, wait for the deploy, run 02-check-hosted.ts --wait.')
    process.exit(1)
  }
}

const payload = await callTool('build_register', {
  network: config.network,
  sender: config.owner,
  agent_uri: state.agentUri,
  metadata_hash_hex: state.cardSha256,
})

mkdirSync(paths.data, { recursive: true })
const file = join(paths.data, 'register-payload.json')
writeFileSync(file, JSON.stringify(payload, null, 2))
console.log(`\nSaved ${file}`)
console.log('Next: node scripts/registry/04-sign-submit.ts   (dry run, no key needed)')
