import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSetAgentWalletMessage } from '../src/registry/agentWalletMessage.ts'
import { TESTNET_REGISTRY } from '../src/registry/types.ts'

const OWNER = '47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk'
const GENESIS = '4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796'

// Captured from the hosted service (set_agent_wallet_canonical_bytes, testnet, 2026-11-05)
// for token 0, new_wallet = OWNER, deadline_unix_ms = 1893456000000.
const SERVICE_BYTES_HEX =
  '4349532d383030342f76312f7365744167656e7457616c6c657400000000000000009aa5f5820746bddf03d9e97e41907a15a89a85c96938a23bf7ba62611fd0b17800b4c5dab8010000023200000000000000000000000000004221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796'

void describe('setAgentWallet canonical message', () => {
  void it('matches byte for byte what the hosted service returned', () => {
    const local = buildSetAgentWalletMessage({
      tokenId: 0,
      newWallet: OWNER,
      deadlineUnixMs: 1893456000000,
      contract: TESTNET_REGISTRY,
      genesisHashHex: GENESIS,
    })
    assert.equal(local.length, 122)
    assert.equal(local.toString('hex'), SERVICE_BYTES_HEX)
  })

  void it('changes when any signed field changes (token, wallet, deadline, genesis)', () => {
    const base = { tokenId: 0, newWallet: OWNER, deadlineUnixMs: 1893456000000, contract: TESTNET_REGISTRY, genesisHashHex: GENESIS }
    const reference = buildSetAgentWalletMessage(base).toString('hex')
    const variants = [
      { ...base, tokenId: 1 },
      { ...base, newWallet: '3HKu4eSXZBTeCmf6XV51EQ1HuBe3tDNDo1TbDcEBzPgYrRHg1V' },
      { ...base, deadlineUnixMs: 1893456000001 },
      { ...base, genesisHashHex: '00'.repeat(32) },
    ]
    for (const variant of variants) assert.notEqual(buildSetAgentWalletMessage(variant).toString('hex'), reference)
  })
})
