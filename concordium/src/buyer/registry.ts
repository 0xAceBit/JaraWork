/** Registry calls used by verifyValidator. Shapes observed on testnet 2026-11-05 (trajectory/run-05.md). */
import { InvalidTokenAddressError } from '../registry/types.ts'

export interface AgentRecord {
  tokenId: string
  tokenAddress: string
  owner: string
  agentUri: string
  metadataHash: string
  status: string
  agentWallet: string | null
}

export interface ValidatorRegistry {
  /** Throws InvalidTokenAddressError when the badge is not a valid CIS-2 token address. */
  parseTokenAddress(badge: string): Promise<{ contract: { index: number; subindex: number }; tokenId: string }>
  agentByTokenAddress(badge: string): Promise<AgentRecord | null>
  isActive(tokenId: string): Promise<{ exists: boolean; active: boolean; status: string | null }>
  /** match is null when the registry could not fetch the card at all. */
  verifyAgentCard(tokenId: string): Promise<{ match: boolean | null; onChainHash: string; uri: string }>
}

const ENDPOINT = 'https://agent-registry-mcp.concordium.com/mcp'

async function call(tool: string, args: Record<string, unknown>, network: string): Promise<{ isError: boolean; data: unknown }> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: { network, ...args } } }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`registry HTTP ${response.status}`)
  const body = (await response.json()) as { result?: { content?: { text?: string }[]; isError?: boolean }; error?: { message?: string } }
  if (body.error) throw new Error(body.error.message ?? 'registry JSON-RPC error')
  const text = body.result?.content?.[0]?.text
  if (text === undefined) throw new Error('registry returned no content')
  let data: unknown = text
  try {
    data = JSON.parse(text)
  } catch {
    // error results are plain text
  }
  return { isError: body.result?.isError === true, data }
}

type Row = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function hostedValidatorRegistry(network = 'testnet'): ValidatorRegistry {
  return {
    async parseTokenAddress(badge) {
      const r = await call('parse_token_address', { token_address: badge }, network)
      if (r.isError) throw new InvalidTokenAddressError(badge)
      const d = r.data as Row
      return { contract: { index: Number(d.contract_index), subindex: Number(d.contract_subindex) }, tokenId: str(d.token_id) }
    },
    async agentByTokenAddress(badge) {
      const r = await call('agent_by_token_address', { token_address: badge }, network)
      if (r.isError || r.data === null || typeof r.data !== 'object') return null
      const d = r.data as Row
      return {
        tokenId: str(d.token_id),
        tokenAddress: str(d.token_address),
        owner: str(d.owner_account),
        agentUri: str(d.agent_uri),
        metadataHash: str(d.metadata_hash_hex),
        status: str(d.status),
        agentWallet: typeof d.agent_wallet === 'string' ? d.agent_wallet : null,
      }
    },
    async isActive(tokenId) {
      const d = (await call('is_active', { token_id: tokenId }, network)).data as Row
      return { exists: d.exists === true, active: d.active === true, status: typeof d.status === 'string' ? d.status : null }
    },
    async verifyAgentCard(tokenId) {
      const d = (await call('verify_agent_card', { token_id: tokenId }, network)).data as Row
      return { match: typeof d.match === 'boolean' ? d.match : null, onChainHash: str(d.on_chain_hash_hex), uri: str(d.on_chain_uri) }
    },
  }
}
