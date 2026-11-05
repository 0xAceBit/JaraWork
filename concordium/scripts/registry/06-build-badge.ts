/**
 * Step 6: add the badge to the card.
 * Runs BOTH documented routes and cross-checks them:
 *   A. get_badge_json  (badge -> the extension block to paste in)
 *   B. build_agent_badge (merges the badge into the card we serve, returns card + hash)
 * Saves route B's card to public/agent-card.json. Then YOU push it; step 7 pins the hash.
 *
 * Usage: node scripts/registry/06-build-badge.ts   (needs a registered token, see step 5)
 */
import { writeFileSync } from 'node:fs'
import { callTool, config, paths, readState, sha256Hex, show, writeState } from './lib.ts'

const state = readState()
if (!state.tokenId || !state.tokenAddress || !state.agentUri) throw new Error('No registered token in state. Run 05-verify.ts first.')

interface Extension {
  uri?: string
  params?: { tokenAddress?: string | null }
}

// Route A
const routeA = await callTool('get_badge_json', { network: config.network, token_address: state.tokenAddress })
const extensionA = routeA.extension as Extension | undefined

// Route B: the service fetches the card we currently serve and merges the badge in.
const routeB = await callTool('build_agent_badge', {
  network: config.network,
  owner_account: config.owner,
  card_url: state.agentUri,
  token_id: state.tokenId,
})
const mergedJson = routeB.agent_card_json
const returnedHash = routeB.metadata_hash_hex
if (typeof mergedJson !== 'string' || typeof returnedHash !== 'string') throw new Error('Unexpected build_agent_badge response shape')

const bytes = Buffer.from(mergedJson, 'utf8')
const computed = sha256Hex(bytes)
const merged = JSON.parse(mergedJson) as { capabilities?: { extensions?: Extension[] }; registrations?: { agentId?: number }[] } & Record<string, unknown>
const extensionB = merged.capabilities?.extensions?.find((e) => e.uri?.includes('concordium-badge'))

writeFileSync(paths.cardFile, bytes)
writeState({ previousCardSha256: state.cardSha256, cardSha256: computed })

show('CHECKS', {
  savedTo: 'public/agent-card.json',
  byteLength: bytes.length,
  hashMatchesBytes: computed === returnedHash,
  routeA_tokenAddress: extensionA?.params?.tokenAddress ?? null,
  routeB_tokenAddress: extensionB?.params?.tokenAddress ?? null,
  routesAgree: Boolean(extensionA) && extensionA?.params?.tokenAddress === extensionB?.params?.tokenAddress,
  cardHasRegistrationsEntry: Array.isArray(merged.registrations) && merged.registrations.length > 0,
  buildAgentBadgeAction: routeB.action,
})
console.log('\nNext: commit and push public/agent-card.json, run 02-check-hosted.ts --wait, then 07-build-set-agent-uri.ts')
process.exit(computed === returnedHash ? 0 : 1)
