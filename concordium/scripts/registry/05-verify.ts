/**
 * Step 5 (and again after step 7): verify the registration.
 * Finds our token (from state, or via the owner's agents), then runs
 * agent_of, is_active, verify_agent_card and check_badge. Read-only, no keys.
 *
 * Usage: node scripts/registry/05-verify.ts
 */
import { callTool, config, readState, show, writeState } from './lib.ts'

interface AgentRow {
  token_id: number | string
  agent_uri?: string
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function resolveToken(): Promise<{ tokenId: string; tokenAddress: string }> {
  const state = readState()
  if (state.tokenId && state.tokenAddress) return { tokenId: state.tokenId, tokenAddress: state.tokenAddress }

  // The indexer can lag the chain by a few blocks, so retry for about 90 seconds.
  for (let attempt = 1; attempt <= 9; attempt++) {
    const result = await callTool('agents_by_owner', { network: config.network, owner_account: config.owner, limit: 50 })
    const mine = ((result.agents as AgentRow[] | undefined) ?? []).filter((a) => a.agent_uri === state.agentUri)
    if (mine.length > 0) {
      const newest = mine.reduce((a, b) => (Number(b.token_id) > Number(a.token_id) ? b : a))
      const tokenId = String(newest.token_id)
      const agent = await callTool('agent_of', { network: config.network, token_id: tokenId })
      if (typeof agent.token_address !== 'string') throw new Error('agent_of returned no token_address')
      writeState({ tokenId, tokenAddress: agent.token_address })
      return { tokenId, tokenAddress: agent.token_address }
    }
    console.log(`\nNo agent for our card yet (attempt ${attempt}/9). Waiting 10 s for the indexer...`)
    await sleep(10_000)
  }
  throw new Error('Could not find our agent. Has the register transaction finalized? Check registerTx in .data/registry-state.json.')
}

const { tokenId, tokenAddress } = await resolveToken()
show('OUR AGENT', { tokenId, tokenAddress })

await callTool('agent_of', { network: config.network, token_id: tokenId })
const active = await callTool('is_active', { network: config.network, token_id: tokenId })
const card = await callTool('verify_agent_card', { network: config.network, token_id: tokenId })
const badge = await callTool('check_badge', { network: config.network, id: tokenAddress })

show('SUMMARY', {
  active: active.active,
  cardHashMatchesOnChain: card.match,
  fetchedHttpStatus: (card.fetched as { http_status?: number } | undefined)?.http_status,
  badgeValid: badge.badge_valid,
  badgeChecks: badge.checks,
  issues: badge.issues,
})
console.log(
  card.match === true
    ? '\nCard hash matches the chain. If badgeValid is false and the issues mention the badge, that is expected until steps 6 and 7 are done.'
    : card.match === null
      ? '\nThe registry could NOT FETCH the card (match is null, not false). On Render free tier this usually means the service was asleep: open the card URL once in a browser, then rerun this script.'
      : '\nThe card hash does NOT match the chain (match is false). Do not continue until this is fixed (step 2 shows what the server serves).',
)
process.exit(card.match === true ? 0 : 1)
