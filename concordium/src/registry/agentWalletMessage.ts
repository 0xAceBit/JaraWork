/**
 * The canonical message the NEW wallet's controller signs for setAgentWallet.
 * Layout (from the set_agent_wallet_canonical_bytes tool description, 122 bytes):
 *   "CIS-8004/v1/setAgentWallet" (26) + token_id u64 LE (8) + new_wallet (32)
 *   + deadline_unix_ms u64 LE (8) + registry contract index u64 LE + subindex u64 LE (16)
 *   + genesis hash (32)
 * Built locally so a script can cross-check the hosted service before anything is signed.
 */
import { AccountAddress } from '@concordium/web-sdk'
import type { ContractRef } from './types.ts'

const PREFIX = 'CIS-8004/v1/setAgentWallet'

function u64le(value: bigint): Buffer {
  const out = Buffer.alloc(8)
  out.writeBigUInt64LE(value)
  return out
}

export function buildSetAgentWalletMessage(input: {
  tokenId: string | number | bigint
  newWallet: string
  deadlineUnixMs: number | bigint
  contract: ContractRef
  genesisHashHex: string
}): Buffer {
  const genesis = Buffer.from(input.genesisHashHex, 'hex')
  if (genesis.length !== 32) throw new Error('genesis hash must be 32 bytes')
  const message = Buffer.concat([
    Buffer.from(PREFIX, 'utf8'),
    u64le(BigInt(input.tokenId)),
    Buffer.from(AccountAddress.fromBase58(input.newWallet).decodedAddress),
    u64le(BigInt(input.deadlineUnixMs)),
    u64le(BigInt(input.contract.index)),
    u64le(BigInt(input.contract.subindex)),
    genesis,
  ])
  if (message.length !== 122) throw new Error(`canonical message must be 122 bytes, got ${message.length}`)
  return message
}
