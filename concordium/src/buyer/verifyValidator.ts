/**
 * verifyValidator(badge): everything the buyer must establish BEFORE paying a validator.
 *   1 parse_token_address   2 agent_by_token_address   3 is_active
 *   4 verify_agent_card (+ our own hash of the card)   4b the card's MCP endpoint is the service we will call
 *   5 resolvePayee (agentWallet read from the chain)
 * Every refusal names its reason. Nothing is paid and nothing is sent to the validator here.
 */
import { createHash } from 'node:crypto'
import { resolvePayee } from '../registry/resolvePayee.ts'
import { InvalidTokenAddressError, type ContractRef, type RegistryReader } from '../registry/types.ts'
import type { ValidatorRegistry } from './registry.ts'

export type RefusalCode =
  | 'UNKNOWN_BADGE'
  | 'UNTRUSTED_REGISTRY'
  | 'REVOKED_AGENT'
  | 'HASH_MISMATCH'
  | 'CARD_UNREACHABLE'
  | 'ENDPOINT_MISMATCH'
  | 'MISSING_AGENT_WALLET'
  | 'REGISTRY_UNAVAILABLE'

export interface VerifiedValidator {
  badge: string
  tokenId: string
  owner: string
  agentUri: string
  metadataHash: string
  /** The payee, read from the chain. */
  wallet: string
  /** The MCP endpoint the verified card lists, equal to the service we will call. */
  endpoint: string
}

export type VerifyResult =
  | { ok: true; validator: VerifiedValidator }
  | { ok: false; code: RefusalCode; reason: string; retryable: boolean; step: string }

export interface VerifyDeps {
  registry: ValidatorRegistry
  /** Used by resolvePayee; defaults to the hosted reader. */
  payeeReader?: RegistryReader
  trustedRegistry: ContractRef
  /** The MCP URL the buyer is about to call. */
  serviceUrl: string
  /** Returns the exact bytes served at the card URL. */
  fetchCard: (uri: string) => Promise<Uint8Array>
}

const refuse = (step: string, code: RefusalCode, reason: string, retryable = false): VerifyResult => ({ ok: false, code, reason, retryable, step })

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/** The MCP endpoint listed in the card's services (ERC-8004 style), or null. */
export function cardMcpEndpoint(card: unknown): string | null {
  const services = (card as { services?: unknown } | null)?.services
  if (!Array.isArray(services)) return null
  for (const service of services as { name?: unknown; endpoint?: unknown }[]) {
    if (typeof service.name === 'string' && service.name.toLowerCase() === 'mcp' && typeof service.endpoint === 'string') {
      return service.endpoint
    }
  }
  return null
}

export async function verifyValidator(badge: string, deps: VerifyDeps): Promise<VerifyResult> {
  const { registry } = deps

  // 1. parse_token_address
  let tokenId: string
  try {
    const parsed = await registry.parseTokenAddress(badge)
    if (parsed.contract.index !== deps.trustedRegistry.index || parsed.contract.subindex !== deps.trustedRegistry.subindex) {
      return refuse('1 parse_token_address', 'UNTRUSTED_REGISTRY', `The badge belongs to contract ${parsed.contract.index},${parsed.contract.subindex}, not the trusted registry ${deps.trustedRegistry.index},${deps.trustedRegistry.subindex}.`)
    }
    tokenId = parsed.tokenId
  } catch (error) {
    if (error instanceof InvalidTokenAddressError) return refuse('1 parse_token_address', 'UNKNOWN_BADGE', 'The badge is not a valid CIS-2 token address.')
    return refuse('1 parse_token_address', 'REGISTRY_UNAVAILABLE', 'The registry could not be reached.', true)
  }

  try {
    // 2. agent_by_token_address
    const agent = await registry.agentByTokenAddress(badge)
    if (agent === null) return refuse('2 agent_by_token_address', 'UNKNOWN_BADGE', 'No agent is registered for this badge in the trusted registry.')

    // 3. is_active
    const activity = await registry.isActive(tokenId)
    if (!activity.exists) return refuse('3 is_active', 'UNKNOWN_BADGE', 'The registry has no agent for this badge.')
    if (!activity.active) return refuse('3 is_active', 'REVOKED_AGENT', `The agent is not active (status: ${activity.status ?? 'unknown'}). It was revoked or removed.`)

    // 4. verify_agent_card: the registry says the served card hashes to the on-chain value
    const verified = await registry.verifyAgentCard(tokenId)
    if (verified.match === null) return refuse('4 verify_agent_card', 'CARD_UNREACHABLE', 'The registry could not fetch the agent card. The host may be asleep or down.', true)
    if (verified.match === false) return refuse('4 verify_agent_card', 'HASH_MISMATCH', 'The card served at the agent URL does not hash to the metadata hash pinned on chain.')

    // 4 again, independently: hash the card ourselves. A hosted service saying "true" is not enough.
    let bytes: Uint8Array
    try {
      bytes = await deps.fetchCard(agent.agentUri)
    } catch {
      return refuse('4 verify_agent_card', 'CARD_UNREACHABLE', 'The agent card could not be fetched for an independent check.', true)
    }
    const ours = createHash('sha256').update(bytes).digest('hex')
    if (ours !== agent.metadataHash.toLowerCase()) {
      return refuse('4 verify_agent_card', 'HASH_MISMATCH', `The card we fetched hashes to ${ours.slice(0, 12)}..., the chain pins ${agent.metadataHash.slice(0, 12)}...`)
    }

    // 4b. the verified card must list the MCP endpoint we are about to call
    let card: unknown
    try {
      card = JSON.parse(Buffer.from(bytes).toString('utf8'))
    } catch {
      return refuse('4b card endpoint', 'ENDPOINT_MISMATCH', 'The verified card is not valid JSON, so it lists no service endpoint.')
    }
    const listed = cardMcpEndpoint(card)
    if (listed === null) return refuse('4b card endpoint', 'ENDPOINT_MISMATCH', 'The verified card lists no MCP service endpoint, so it does not vouch for the service being called.')
    if (normalizeUrl(listed) === null || normalizeUrl(listed) !== normalizeUrl(deps.serviceUrl)) {
      return refuse('4b card endpoint', 'ENDPOINT_MISMATCH', `The card lists ${listed} but the service being called is ${deps.serviceUrl}.`)
    }

    // 5. resolvePayee: the wallet to pay comes from the chain, never from the card or the server
    const payee = await resolvePayee(badge, { trustedRegistry: deps.trustedRegistry, ...(deps.payeeReader ? { reader: deps.payeeReader } : {}) })
    if (!payee.ok) {
      const code: RefusalCode =
        payee.code === 'AGENT_WALLET_UNSET' ? 'MISSING_AGENT_WALLET'
        : payee.code === 'AGENT_REVOKED' ? 'REVOKED_AGENT'
        : payee.code === 'REGISTRY_UNAVAILABLE' ? 'REGISTRY_UNAVAILABLE'
        : 'UNKNOWN_BADGE'
      return refuse('5 resolvePayee', code, payee.reason, payee.code === 'REGISTRY_UNAVAILABLE')
    }

    return {
      ok: true,
      validator: { badge, tokenId, owner: agent.owner, agentUri: agent.agentUri, metadataHash: agent.metadataHash, wallet: payee.wallet, endpoint: listed },
    }
  } catch {
    return refuse('registry', 'REGISTRY_UNAVAILABLE', 'The registry could not be reached.', true)
  }
}
