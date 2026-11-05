/**
 * resolvePayee: who may be paid for an agent's work.
 *
 * The answer comes ONLY from the registry on chain (agentWallet). Anything the
 * agent card claims is compared and reported but never used to choose the payee.
 * Every failure refuses to pay; there is no fallback to the card.
 */
import { AccountAddress } from '@concordium/web-sdk'
import { hostedRegistryReader } from './hostedReader.ts'
import {
  InvalidTokenAddressError,
  TESTNET_REGISTRY,
  type PayeeRefusalCode,
  type PayeeResult,
  type RegistryReader,
  type ResolveOptions,
} from './types.ts'

const refuse = (code: PayeeRefusalCode, reason: string): PayeeResult => ({ ok: false, code, reason })

function unavailable(error: unknown): PayeeResult {
  const detail = (error instanceof Error ? error.message : String(error)).slice(0, 120)
  return refuse(
    'REGISTRY_UNAVAILABLE',
    `Could not read the registry (${detail}). Refusing to pay rather than falling back to the agent card.`,
  )
}

/** Concordium account aliases share their first 29 bytes, so two different strings can be one account. */
export function sameAccount(a: string, b: string): boolean {
  try {
    const x = AccountAddress.fromBase58(a).decodedAddress
    const y = AccountAddress.fromBase58(b).decodedAddress
    return x.length === 32 && y.length === 32 && x.subarray(0, 29).every((byte, i) => byte === y[i])
  } catch {
    return false
  }
}

/** get_agent_wallet returns null both for a cleared wallet and for a token that does not exist. Say which. */
async function explainMissingWallet(reader: RegistryReader, tokenId: string): Promise<PayeeResult> {
  let agent
  try {
    agent = await reader.getAgent(tokenId)
  } catch (error) {
    return unavailable(error)
  }
  if (agent === null) {
    return refuse('AGENT_NOT_FOUND', `No agent exists for token ${tokenId} in the trusted registry. Refusing to pay.`)
  }
  if (agent.status !== 'Active') {
    return refuse('AGENT_REVOKED', `Agent ${tokenId} is ${agent.status}, not Active. Refusing to pay.`)
  }
  return refuse(
    'AGENT_WALLET_UNSET',
    `agentWallet is not set for agent ${tokenId}. When an agent NFT is transferred the registry clears it until the new ` +
      'owner runs setAgentWallet, so there is no payee to trust. Refusing to pay. The agent card is not used as a fallback.',
  )
}

export async function resolvePayee(tokenAddress: string, options: ResolveOptions = {}): Promise<PayeeResult> {
  const reader = options.reader ?? hostedRegistryReader()
  const trusted = options.trustedRegistry ?? TESTNET_REGISTRY

  let parsed
  try {
    parsed = await reader.parseTokenAddress(tokenAddress)
  } catch (error) {
    if (error instanceof InvalidTokenAddressError) {
      return refuse('INVALID_TOKEN_ADDRESS', `"${tokenAddress.slice(0, 40)}" is not a valid CIS-2 token address. ${error.message}`.slice(0, 240))
    }
    return unavailable(error)
  }

  if (parsed.contract.index !== trusted.index || parsed.contract.subindex !== trusted.subindex) {
    return refuse(
      'UNTRUSTED_REGISTRY',
      `Token belongs to contract ${parsed.contract.index},${parsed.contract.subindex}, not the trusted registry ${trusted.index},${trusted.subindex}.`,
    )
  }

  let wallet: string | null
  try {
    wallet = await reader.getAgentWallet(parsed.tokenId)
  } catch (error) {
    return unavailable(error)
  }
  if (wallet === null) return explainMissingWallet(reader, parsed.tokenId)

  try {
    AccountAddress.fromBase58(wallet)
  } catch {
    return refuse('WALLET_INVALID', 'The registry returned an agentWallet that is not a valid account address. Refusing to pay.')
  }

  const warnings: string[] = []
  const claimed = options.cardClaimedWallet
  if (claimed === undefined) {
    return { ok: true, wallet, tokenId: parsed.tokenId, source: 'chain', warnings }
  }
  const matchesChain = claimed === wallet || sameAccount(claimed, wallet)
  if (!matchesChain) warnings.push(`Card claims ${claimed} but the chain says ${wallet}. Using the chain value.`)
  return { ok: true, wallet, tokenId: parsed.tokenId, source: 'chain', cardClaim: { claimed, matchesChain }, warnings }
}
