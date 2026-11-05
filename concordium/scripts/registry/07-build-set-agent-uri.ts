/**
 * Step 7: pin the new card hash on chain.
 * The hash is computed from the bytes the public URL ACTUALLY SERVES right now,
 * not from the local file. Output is a sign-ready setAgentURI payload; sign it
 * with 04-sign-submit.ts --payload .data/set-agent-uri-payload.json [--submit].
 *
 * Usage: node scripts/registry/07-build-set-agent-uri.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { callTool, config, paths, readState, sha256Hex, show } from './lib.ts'

const state = readState()
if (!state.tokenId || !state.agentUri) throw new Error('No registered token in state. Run 05-verify.ts first.')

const res = await fetch(state.agentUri, { headers: { 'cache-control': 'no-cache' } })
const servedSha256 = sha256Hex(Buffer.from(await res.arrayBuffer()))
show('SERVED BYTES (what the registry will fetch)', {
  url: state.agentUri,
  status: res.status,
  servedSha256,
  expectedFromStep6: state.cardSha256,
  previouslyPinned: state.previousCardSha256,
  servedMatchesExpected: servedSha256 === state.cardSha256,
})
if (res.status !== 200) throw new Error(`The card URL returned HTTP ${res.status}.`)
if (servedSha256 !== state.cardSha256) {
  console.error('\nThe live server is not serving the card from step 6 yet. Push, wait for the deploy (02-check-hosted.ts --wait), then rerun.')
  process.exit(1)
}

// agent_uri is omitted on purpose: the docs say omitting it leaves the URI unchanged.
const payload = await callTool('build_set_agent_uri', {
  network: config.network,
  token_id: Number(state.tokenId),
  metadata_hash_hex: servedSha256,
  sender: config.owner,
})

mkdirSync(paths.data, { recursive: true })
const file = join(paths.data, 'set-agent-uri-payload.json')
writeFileSync(file, JSON.stringify(payload, null, 2))
console.log(`\nSaved ${file}`)
console.log('Next: node scripts/registry/04-sign-submit.ts --payload .data/set-agent-uri-payload.json   (dry run), then add --submit')
