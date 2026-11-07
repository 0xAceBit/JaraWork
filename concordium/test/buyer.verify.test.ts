import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { verifyValidator, type VerifyDeps, type VerifyResult } from '../src/buyer/verifyValidator.ts'
import type { AgentRecord, ValidatorRegistry } from '../src/buyer/registry.ts'
import { InvalidTokenAddressError, TESTNET_REGISTRY, type RegistryReader } from '../src/registry/types.ts'

const BADGE = 'JyP9YR6Wk3YPaGx3e8zyu'
const SERVICE = 'https://validator.example/mcp'
const OWNER = '47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk'
const sha = (text: string): string => createHash('sha256').update(text).digest('hex')
const cardWith = (endpoint: string | null): string =>
  JSON.stringify({ name: 'Validator', services: endpoint === null ? [] : [{ name: 'MCP', endpoint, version: '2025-06-18' }] })

interface World {
  cardText: string
  chainHash: string | null // null = the hash of cardText
  contract: { index: number; subindex: number }
  exists: boolean
  active: boolean
  status: string
  hostedMatch: boolean | null
  wallet: string | null
  down: boolean
  malformed: boolean
}
const calls: string[] = []

function build(over: Partial<World> = {}): VerifyDeps {
  const w: World = { cardText: cardWith(SERVICE), chainHash: null, contract: TESTNET_REGISTRY, exists: true, active: true, status: 'Active', hostedMatch: true, wallet: OWNER, down: false, malformed: false, ...over }
  calls.length = 0
  const record = (): AgentRecord => ({ tokenId: '1008', tokenAddress: BADGE, owner: OWNER, agentUri: 'https://validator.example/card.json', metadataHash: w.chainHash ?? sha(w.cardText), status: w.status, agentWallet: w.wallet })
  const registry: ValidatorRegistry = {
    parseTokenAddress: () => {
      calls.push('parse')
      if (w.down) return Promise.reject(new Error('network down'))
      if (w.malformed) return Promise.reject(new InvalidTokenAddressError(BADGE))
      return Promise.resolve({ contract: w.contract, tokenId: '1008' })
    },
    agentByTokenAddress: () => {
      calls.push('agent')
      return Promise.resolve(w.exists ? record() : null)
    },
    isActive: () => {
      calls.push('active')
      return Promise.resolve({ exists: w.exists, active: w.active, status: w.status })
    },
    verifyAgentCard: () => {
      calls.push('verify')
      return Promise.resolve({ match: w.hostedMatch, onChainHash: record().metadataHash, uri: record().agentUri })
    },
  }
  const payeeReader: RegistryReader = {
    parseTokenAddress: () => Promise.resolve({ contract: w.contract, tokenId: '1008' }),
    getAgentWallet: () => {
      calls.push('wallet')
      return Promise.resolve(w.wallet)
    },
    getAgent: () => Promise.resolve(w.exists ? { status: w.status, ownerAccount: OWNER } : null),
  }
  return { registry, payeeReader, trustedRegistry: TESTNET_REGISTRY, serviceUrl: SERVICE, fetchCard: () => Promise.resolve(Buffer.from(w.cardText)) }
}

function refusal(result: VerifyResult): Extract<VerifyResult, { ok: false }> {
  assert.equal(result.ok, false, 'expected a refusal')
  return result
}

void describe('verifyValidator: the happy path', () => {
  void it('passes every check, takes the payee from the chain and returns the verified endpoint', async () => {
    const result = await verifyValidator(BADGE, build())
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.validator.wallet, OWNER)
      assert.equal(result.validator.endpoint, SERVICE)
      assert.equal(result.validator.tokenId, '1008')
    }
    assert.deepEqual(calls.slice(0, 4), ['parse', 'agent', 'active', 'verify'])
  })

  void it('treats a trailing slash and host case in the card endpoint as the same service', async () => {
    const result = await verifyValidator(BADGE, build({ cardText: cardWith('https://Validator.EXAMPLE/mcp/') }))
    assert.equal(result.ok, true)
  })
})

void describe('verifyValidator: each refusal, with its specific reason', () => {
  void it('unknown badge: no agent is registered for it', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ exists: false })))
    assert.equal(r.code, 'UNKNOWN_BADGE')
    assert.match(r.reason, /No agent is registered/)
    assert.deepEqual(calls, ['parse', 'agent'], 'nothing after the failed step may run')
  })

  void it('unknown badge: not even a valid token address', async () => {
    const r = refusal(await verifyValidator('not-a-badge', build({ malformed: true })))
    assert.equal(r.code, 'UNKNOWN_BADGE')
    assert.match(r.reason, /not a valid CIS-2 token address/)
  })

  void it('revoked agent: the registry says it is not active', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ active: false, status: 'Revoked' })))
    assert.equal(r.code, 'REVOKED_AGENT')
    assert.match(r.reason, /Revoked/)
    assert.ok(!calls.includes('verify'), 'must stop before looking at the card')
  })

  void it('hash mismatch: the registry reports the served card does not match the chain', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ hostedMatch: false })))
    assert.equal(r.code, 'HASH_MISMATCH')
    assert.match(r.reason, /does not hash to the metadata hash pinned on chain/)
  })

  void it('hash mismatch: caught by our own hashing even when the hosted service says true', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ hostedMatch: true, chainHash: sha('some other card') })))
    assert.equal(r.code, 'HASH_MISMATCH')
    assert.match(r.reason, /we fetched hashes to/)
  })

  void it('card endpoint not matching the service called: the card names a different service', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ cardText: cardWith('https://elsewhere.example/mcp') })))
    assert.equal(r.code, 'ENDPOINT_MISMATCH')
    assert.match(r.reason, /elsewhere\.example/)
    assert.match(r.reason, /validator\.example/)
  })

  void it('card endpoint not matching the service called: the card lists no MCP service at all', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ cardText: cardWith(null) })))
    assert.equal(r.code, 'ENDPOINT_MISMATCH')
    assert.match(r.reason, /lists no MCP service endpoint/)
  })

  void it('missing agentWallet: there is nobody the registry says to pay', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ wallet: null })))
    assert.equal(r.code, 'MISSING_AGENT_WALLET')
    assert.match(r.reason, /agentWallet is not set/)
  })
})

void describe('verifyValidator: other safe refusals', () => {
  void it('a badge from another registry contract is untrusted', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ contract: { index: 999, subindex: 0 } })))
    assert.equal(r.code, 'UNTRUSTED_REGISTRY')
  })

  void it('a card the registry could not fetch is refused as retryable, not as a mismatch', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ hostedMatch: null })))
    assert.equal(r.code, 'CARD_UNREACHABLE')
    assert.equal(r.retryable, true)
  })

  void it('a registry outage is a retryable refusal', async () => {
    const r = refusal(await verifyValidator(BADGE, build({ down: true })))
    assert.equal(r.code, 'REGISTRY_UNAVAILABLE')
    assert.equal(r.retryable, true)
  })
})
