/**
 * Step 8: set the validator's agentWallet (CIS-8004 setAgentWallet).
 *
 * Two authorisations are needed: the owner signs the TRANSACTION (done by 04-sign-submit.ts),
 * and the NEW wallet's controller signs a 122-byte MESSAGE (done here).
 *   - new wallet = the owner account (default): signed with CCD_OWNER_PRIVATE_KEY
 *   - any other account: signed with CCD_PAYEE_PRIVATE_KEY (that account's key)
 * Keys come from concordium/.env, are never printed, and never leave this process.
 *
 * Usage: node scripts/registry/08-set-agent-wallet.ts [--new-wallet ADDR] [--format raw|wallet] [--minutes 30] [--force]
 *   --format raw     signature over the 122 bytes exactly as the tool describes (default)
 *   --format wallet  SDK signMessage (prepends account address + 8 zero bytes)
 *   The docs do not say which the contract verifies. Step 04 (dry run) simulates the call,
 *   so a wrong choice is caught before anything is sent.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AccountAddress, BlockHash, buildBasicAccountSigner, signMessage } from '@concordium/web-sdk'
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'
import { buildSetAgentWalletMessage } from '../../src/registry/agentWalletMessage.ts'
import { sameAccount } from '../../src/registry/resolvePayee.ts'
import { TESTNET_REGISTRY } from '../../src/registry/types.ts'
import { callTool, config, flagValue, hasFlag, paths, readState, requireEnv, show } from './lib.ts'

const state = readState()
if (!state.tokenId) {
  console.error('No registered token yet. Run 04-sign-submit.ts --submit (registration) and 05-verify.ts first.')
  process.exit(1)
}
const tokenId = state.tokenId
const newWallet = flagValue('--new-wallet') ?? config.owner
const format = flagValue('--format') ?? 'raw'
if (format !== 'raw' && format !== 'wallet') throw new Error('--format must be raw or wallet')
const deadlineUnixMs = Date.now() + Number(flagValue('--minutes') ?? '30') * 60_000

// 1. What does the chain say today?
const current = (await callTool('get_agent_wallet', { network: config.network, token_id: Number(tokenId) })).agent_wallet
if (typeof current === 'string' && sameAccount(current, newWallet) && !hasFlag('--force')) {
  console.log(`\nagentWallet is already ${current}. Nothing to change. (Use --force to send the transaction anyway.)`)
  process.exit(0)
}

// 2. Build the 122-byte message locally and cross-check it against the hosted service and the node.
const client = new ConcordiumGRPCNodeClient(config.grpcHost, config.grpcPort, credentials.createSsl(), { timeout: 20_000 })
const genesisHashHex = BlockHash.toHexString((await client.getConsensusStatus()).genesisBlock)
const message = buildSetAgentWalletMessage({ tokenId, newWallet, deadlineUnixMs, contract: TESTNET_REGISTRY, genesisHashHex })
const service = await callTool('set_agent_wallet_canonical_bytes', {
  network: config.network,
  token_id: Number(tokenId),
  new_wallet: newWallet,
  deadline_unix_ms: deadlineUnixMs,
})
if (service.bytes_hex !== message.toString('hex')) {
  console.error('\nSTOP: the hosted service returned different bytes than the layout in its own docs. Not signing.')
  process.exit(1)
}
console.log('\nOK: local message (122 bytes) matches the hosted service and the node genesis hash.')

// 3. Sign as the new wallet's controller. The key is read here and never printed.
const keyName = sameAccount(newWallet, config.owner) ? 'CCD_OWNER_PRIVATE_KEY' : 'CCD_PAYEE_PRIVATE_KEY'
const key = requireEnv(keyName).trim().replace(/^0x/i, '')
if (!/^[0-9a-fA-F]{64}$/.test(key)) throw new Error(`${keyName} must be 64 hex characters. Value not shown.`)
const signer = buildBasicAccountSigner(key)
const signature =
  format === 'raw'
    ? await signer.sign(new Uint8Array(message).buffer)
    : await signMessage(AccountAddress.fromBase58(newWallet), message, signer)
const signatureHex = signature[0]?.[0]
if (signatureHex === undefined) throw new Error('signer returned no signature for credential 0, key 0')

// 4. Ask the service for the sign-ready transaction payload.
const payload = await callTool('build_set_agent_wallet', {
  network: config.network,
  token_id: Number(tokenId),
  new_wallet: newWallet,
  deadline_unix_ms: deadlineUnixMs,
  signature_hex: signatureHex,
  sender: config.owner,
})
mkdirSync(paths.data, { recursive: true })
const file = join(paths.data, 'set-agent-wallet-payload.json')
writeFileSync(file, JSON.stringify(payload, null, 2))
show('SAVED', { file, signedWith: keyName, format, deadline: new Date(deadlineUnixMs).toISOString() })
console.log('\nNext: node scripts/registry/04-sign-submit.ts --payload .data/set-agent-wallet-payload.json   (dry run decides if the signature is accepted)')
console.log('If the dry run rejects it, rerun this script with --format wallet.')
