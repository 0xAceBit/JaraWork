/** Shared types for reading the CIS-8004 Agent Registry. */

export interface ContractRef {
  index: number
  subindex: number
}

/** The CIS-8004 registry on Concordium testnet (contract_info, 2026-11-05). */
export const TESTNET_REGISTRY: ContractRef = { index: 12802, subindex: 0 }

export interface RegistryAgent {
  /** "Active" or "Revoked" as reported by the registry. */
  status: string
  ownerAccount: string
}

/** The three chain reads resolvePayee needs. Tests inject a fake; production uses the hosted service. */
export interface RegistryReader {
  /** Split a CIS-2 token address into its registry contract and token id. Throws InvalidTokenAddressError for bad input. */
  parseTokenAddress(tokenAddress: string): Promise<{ contract: ContractRef; tokenId: string }>
  /** Current agentWallet, or null when unset (also null for a token that does not exist). */
  getAgentWallet(tokenId: string): Promise<string | null>
  /** The agent record, or null when no agent has this token id. */
  getAgent(tokenId: string): Promise<RegistryAgent | null>
}

/** Thrown by a reader when the token address itself is malformed (bad input, not an outage). */
export class InvalidTokenAddressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTokenAddressError'
  }
}

export type PayeeRefusalCode =
  | 'INVALID_TOKEN_ADDRESS'
  | 'UNTRUSTED_REGISTRY'
  | 'REGISTRY_UNAVAILABLE'
  | 'AGENT_NOT_FOUND'
  | 'AGENT_REVOKED'
  | 'AGENT_WALLET_UNSET'
  | 'WALLET_INVALID'

export type PayeeResult =
  | {
      ok: true
      /** The wallet to pay. Always the chain value. */
      wallet: string
      tokenId: string
      source: 'chain'
      /** Present only when the caller passed a card claim to compare. */
      cardClaim?: { claimed: string; matchesChain: boolean }
      warnings: string[]
    }
  | { ok: false; code: PayeeRefusalCode; reason: string }

export interface ResolveOptions {
  /** Defaults to the hosted registry service. */
  reader?: RegistryReader
  /** Defaults to the testnet registry. Tokens from any other contract are refused. */
  trustedRegistry?: ContractRef
  /** A wallet the agent card claims. Compared and reported, never used to choose the payee. */
  cardClaimedWallet?: string
}
