import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AccountAddress } from '@concordium/web-sdk'
import { resolvePayee } from '../src/registry/resolvePayee.ts'
import {
  InvalidTokenAddressError,
  TESTNET_REGISTRY,
  type ContractRef,
  type RegistryAgent,
  type RegistryReader,
} from '../src/registry/types.ts'

const OWNER = '47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk'
const OTHER = '3HKu4eSXZBTeCmf6XV51EQ1HuBe3tDNDo1TbDcEBzPgYrRHg1V'
const NEW_OWNER = '3dt3UMPzRASZndjmKpSWgCP2HhmoxZrgs8FDPtZjNHZzj13hhB'
const TOKEN = 'JyP9TtQC3HCNrTYR3sc2T'

/** A fake registry whose state tests can change, like the real chain would. */
function fakeRegistry(initial: { wallet: string | null; agent: RegistryAgent | null; contract?: ContractRef }) {
  const state = { ...initial, down: false, badAddress: false }
  const reader: RegistryReader = {
    parseTokenAddress() {
      if (state.down) return Promise.reject(new Error('connect ETIMEDOUT'))
      if (state.badAddress) return Promise.reject(new InvalidTokenAddressError('invalid character'))
      return Promise.resolve({ contract: state.contract ?? TESTNET_REGISTRY, tokenId: '7' })
    },
    getAgentWallet() {
      return state.down ? Promise.reject(new Error('connect ETIMEDOUT')) : Promise.resolve(state.wallet)
    },
    getAgent() {
      return state.down ? Promise.reject(new Error('connect ETIMEDOUT')) : Promise.resolve(state.agent)
    },
  }
  return { state, reader }
}

const active = (ownerAccount: string): RegistryAgent => ({ status: 'Active', ownerAccount })

void describe('resolvePayee: the chain decides', () => {
  void it('pays the wallet the registry returns', async () => {
    const { reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    const result = await resolvePayee(TOKEN, { reader })
    assert.deepEqual(result, { ok: true, wallet: OWNER, tokenId: '7', source: 'chain', warnings: [] })
  })

  void it('after the agent NFT is transferred, agentWallet is cleared: refuses and says why', async () => {
    const { state, reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    assert.equal((await resolvePayee(TOKEN, { reader })).ok, true, 'payable before the transfer')

    // The NFT moves to a new owner; the registry clears agentWallet until they run setAgentWallet.
    state.wallet = null
    state.agent = active(NEW_OWNER)

    const result = await resolvePayee(TOKEN, { reader, cardClaimedWallet: OWNER })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, 'AGENT_WALLET_UNSET')
    assert.match(result.reason, /transferred/)
    assert.match(result.reason, /setAgentWallet/)
    assert.match(result.reason, /Refusing to pay/)
    assert.match(result.reason, /not used as a fallback/)
  })

  void it('card claims one address, chain says another: the chain value wins', async () => {
    const { reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    const result = await resolvePayee(TOKEN, { reader, cardClaimedWallet: OTHER })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.wallet, OWNER)
    assert.deepEqual(result.cardClaim, { claimed: OTHER, matchesChain: false })
    assert.equal(result.warnings.length, 1)
    assert.ok(result.warnings[0]?.includes(OTHER) && result.warnings[0].includes(OWNER))
  })

  void it('a card claim equal to the chain value raises no warning', async () => {
    const { reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    const result = await resolvePayee(TOKEN, { reader, cardClaimedWallet: OWNER })
    assert.ok(result.ok && result.warnings.length === 0 && result.cardClaim?.matchesChain === true)
  })

  void it('a card claim that is an alias of the same account counts as a match', async () => {
    const bytes = new Uint8Array(AccountAddress.fromBase58(OWNER).decodedAddress)
    bytes[31] = (bytes[31] ?? 0) ^ 0xff // aliases differ only in the last 3 bytes
    const alias = AccountAddress.fromBuffer(bytes.buffer).address
    assert.notEqual(alias, OWNER)
    const { reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    const result = await resolvePayee(TOKEN, { reader, cardClaimedWallet: alias })
    assert.ok(result.ok && result.cardClaim?.matchesChain === true && result.warnings.length === 0)
  })

  void it('never falls back to the card when the chain has no wallet', async () => {
    const { reader } = fakeRegistry({ wallet: null, agent: active(OWNER) })
    const result = await resolvePayee(TOKEN, { reader, cardClaimedWallet: OTHER })
    assert.equal(result.ok, false)
    assert.ok(!('wallet' in result))
  })
})

void describe('resolvePayee: refusals', () => {
  void it('refuses a token from an untrusted registry contract', async () => {
    const { reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER), contract: { index: 99999, subindex: 0 } })
    const result = await resolvePayee(TOKEN, { reader })
    assert.ok(!result.ok && result.code === 'UNTRUSTED_REGISTRY' && result.reason.includes('99999'))
  })

  void it('tells "no such agent" apart from "wallet cleared" (both read as null)', async () => {
    const { reader } = fakeRegistry({ wallet: null, agent: null })
    const result = await resolvePayee(TOKEN, { reader })
    assert.ok(!result.ok && result.code === 'AGENT_NOT_FOUND')
  })

  void it('refuses a revoked agent whose wallet is cleared', async () => {
    const { reader } = fakeRegistry({ wallet: null, agent: { status: 'Revoked', ownerAccount: OWNER } })
    const result = await resolvePayee(TOKEN, { reader })
    assert.ok(!result.ok && result.code === 'AGENT_REVOKED')
  })

  void it('fails closed when the registry is unreachable, even if the card claims a wallet', async () => {
    const { state, reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    state.down = true
    const result = await resolvePayee(TOKEN, { reader, cardClaimedWallet: OTHER })
    assert.ok(!result.ok && result.code === 'REGISTRY_UNAVAILABLE' && /Refusing to pay/.test(result.reason))
  })

  void it('refuses a malformed token address as bad input, not an outage', async () => {
    const { state, reader } = fakeRegistry({ wallet: OWNER, agent: active(OWNER) })
    state.badAddress = true
    const result = await resolvePayee('not-an-address', { reader })
    assert.ok(!result.ok && result.code === 'INVALID_TOKEN_ADDRESS')
  })

  void it('refuses when the registry returns something that is not an account address', async () => {
    const { reader } = fakeRegistry({ wallet: 'definitely-not-base58-0OIl', agent: active(OWNER) })
    const result = await resolvePayee(TOKEN, { reader })
    assert.ok(!result.ok && result.code === 'WALLET_INVALID')
  })
})

// Optional: real reads against the hosted registry. Run with LIVE_REGISTRY=1.
void describe('resolvePayee: live testnet', { skip: process.env.LIVE_REGISTRY !== '1' }, () => {
  void it('resolves an existing testnet agent from the chain', async () => {
    const result = await resolvePayee(TOKEN, { cardClaimedWallet: OTHER })
    assert.ok(result.ok)
    assert.equal(result.wallet, NEW_OWNER)
    assert.equal(result.cardClaim?.matchesChain, false)
  })

  void it('refuses a malformed address with the real service', async () => {
    const result = await resolvePayee('not-an-address')
    assert.ok(!result.ok && result.code === 'INVALID_TOKEN_ADDRESS')
  })
})
