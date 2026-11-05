/**
 * RegistryReader backed by Concordium's hosted registry service (JSON-RPC over HTTP).
 * Tools used: parse_token_address, get_agent_wallet, agent_of. All read the chain.
 * Shapes were observed against testnet on 2026-11-05 (see trajectory/run-05.md).
 */
import { InvalidTokenAddressError, type RegistryAgent, type RegistryReader } from './types.ts'

const DEFAULT_ENDPOINT = 'https://agent-registry-mcp.concordium.com/mcp'

interface RpcBody {
  result?: { content?: { text?: string }[]; isError?: boolean }
  error?: { message?: string }
}

export function hostedRegistryReader(options: { network?: string; endpoint?: string; timeoutMs?: number } = {}): RegistryReader {
  const network = options.network ?? 'testnet'
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const timeoutMs = options.timeoutMs ?? 8000

  async function call(tool: string, args: Record<string, unknown>): Promise<{ isError: boolean; data: unknown }> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: { network, ...args } } }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`registry HTTP ${response.status}`)
    const body = (await response.json()) as RpcBody
    if (body.error) throw new Error(body.error.message ?? 'registry JSON-RPC error')
    const text = body.result?.content?.[0]?.text
    if (text === undefined) throw new Error('registry returned no content')
    let data: unknown = text
    try {
      data = JSON.parse(text)
    } catch {
      // Error results are plain text, not JSON.
    }
    return { isError: body.result?.isError === true, data }
  }

  return {
    async parseTokenAddress(tokenAddress) {
      const { isError, data } = await call('parse_token_address', { token_address: tokenAddress })
      if (isError) {
        const message = String(data)
        // The service reports a malformed address as a tool error mentioning Base58Check.
        if (/base58/i.test(message)) throw new InvalidTokenAddressError(message.slice(0, 120))
        throw new Error(message.slice(0, 120))
      }
      const row = data as { contract_index?: number; contract_subindex?: number; token_id?: string }
      if (typeof row.contract_index !== 'number' || typeof row.contract_subindex !== 'number' || typeof row.token_id !== 'string') {
        throw new Error('unexpected parse_token_address response')
      }
      return { contract: { index: row.contract_index, subindex: row.contract_subindex }, tokenId: row.token_id }
    },

    async getAgentWallet(tokenId) {
      const { isError, data } = await call('get_agent_wallet', { token_id: tokenId })
      if (isError) throw new Error(String(data).slice(0, 120))
      const wallet = (data as { agent_wallet?: string | null }).agent_wallet
      if (wallet === undefined) throw new Error('unexpected get_agent_wallet response')
      return wallet
    },

    async getAgent(tokenId): Promise<RegistryAgent | null> {
      const { isError, data } = await call('agent_of', { token_id: tokenId })
      if (isError) throw new Error(String(data).slice(0, 120))
      if (data === null) return null
      const row = data as { status?: string; owner_account?: string }
      if (typeof row.status !== 'string' || typeof row.owner_account !== 'string') throw new Error('unexpected agent_of response')
      return { status: row.status, ownerAccount: row.owner_account }
    },
  }
}
