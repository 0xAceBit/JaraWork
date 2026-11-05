/**
 * Step 4: take a sign-ready registry payload (register or setAgentURI).
 *
 *   node scripts/registry/04-sign-submit.ts [--payload <file>]            dry run: simulate on the node, send nothing
 *   node scripts/registry/04-sign-submit.ts [--payload <file>] --submit   sign with YOUR key and submit
 *
 * The dry run asks the node to execute the call as your account WITHOUT a signature
 * (invokeContract), so a bad payload is caught before any key is used.
 * The key comes only from CCD_OWNER_PRIVATE_KEY in concordium/.env. It is never printed.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AccountAddress,
  AccountTransactionType,
  CcdAmount,
  ContractAddress,
  Energy,
  Parameter,
  ReceiveName,
  TransactionExpiry,
  TransactionHash,
  buildBasicAccountSigner,
  signTransaction,
  type AccountTransaction,
  type UpdateContractInput,
} from '@concordium/web-sdk'
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'
import { config, flagValue, hasFlag, paths, requireEnv, show, writeState } from './lib.ts'

interface Payload {
  contract_address: { index: number; subindex: number }
  receive_name: string
  parameter_hex: string
  suggested_energy: number
  sender: string
}

const file = flagValue('--payload') ?? join(paths.data, 'register-payload.json')
const p = JSON.parse(readFileSync(file, 'utf8')) as Payload
if (!p.receive_name || typeof p.parameter_hex !== 'string' || !p.contract_address) throw new Error(`Not a registry payload: ${file}`)
if (p.sender !== config.owner) throw new Error(`Payload sender ${p.sender} is not the configured owner ${config.owner}.`)

const client = new ConcordiumGRPCNodeClient(config.grpcHost, config.grpcPort, credentials.createSsl(), { timeout: 20_000 })
const sender = AccountAddress.fromBase58(p.sender)
const contract = ContractAddress.create(BigInt(p.contract_address.index), BigInt(p.contract_address.subindex))
const receiveName = ReceiveName.fromString(p.receive_name)

// 1. Simulate on the node, as the owner account, without any signature.
const sim = await client.invokeContract({
  invoker: sender,
  contract,
  method: receiveName,
  parameter: Parameter.fromHexString(p.parameter_hex),
  amount: CcdAmount.zero(),
  energy: Energy.create(p.suggested_energy),
})
const usedEnergy = Number(sim.usedEnergy.value)
show('SIMULATION (invokeContract, nothing sent)', {
  payloadFile: file,
  call: `${p.receive_name} on <${p.contract_address.index},${p.contract_address.subindex}>`,
  invoker: p.sender,
  result: sim.tag,
  usedEnergy,
  suggestedEnergy: p.suggested_energy,
  rejectReason: sim.tag === 'failure' ? sim.reason : undefined,
})
if (sim.tag !== 'success') {
  console.error('\nThe node says this call would fail. Nothing was sent. Fix the payload first.')
  process.exit(1)
}
if (!hasFlag('--submit')) {
  console.log('\nDRY RUN OK. Nothing was signed or sent. To sign and submit with your key, re-run with --submit.')
  process.exit(0)
}

// 2. Sign with the key from the environment and submit.
const key = requireEnv('CCD_OWNER_PRIVATE_KEY').trim().replace(/^0x/i, '')
if (!/^[0-9a-fA-F]{64}$/.test(key)) throw new Error('CCD_OWNER_PRIVATE_KEY must be 64 hex characters. (Value not shown.)')

const maxEnergy = Math.max(p.suggested_energy, Math.ceil(usedEnergy * 1.5))
const nonce = await client.getNextAccountNonce(sender)
const input: UpdateContractInput = {
  amount: CcdAmount.zero(),
  address: contract,
  receiveName,
  message: Parameter.fromHexString(p.parameter_hex),
  maxContractExecutionEnergy: Energy.create(maxEnergy),
}
const tx: AccountTransaction = {
  type: AccountTransactionType.Update,
  header: { sender, nonce: nonce.nonce, expiry: TransactionExpiry.futureMinutes(10) },
  payload: input,
}
const signature = await signTransaction(tx, buildBasicAccountSigner(key))
const hash = TransactionHash.toHexString(await client.sendAccountTransaction(tx, signature))
show('SUBMITTED', { transactionHash: hash, maxContractExecutionEnergy: maxEnergy, explorer: 'https://testnet.ccdscan.io (search the hash)' })

const finalized = await client.waitForTransactionFinalization(TransactionHash.fromHexString(hash), 120_000)
const summary = finalized.summary as unknown as { transactionType?: string; rejectReason?: unknown; cost?: unknown }
show('FINALIZED', { blockHash: String(finalized.blockHash), transactionType: summary.transactionType, rejectReason: summary.rejectReason, cost: summary.cost })

const ok = summary.transactionType === 'update'
writeState(p.receive_name.toLowerCase().includes('register') ? { registerTx: hash } : { setUriTx: hash })
console.log(ok ? '\nOK. The call was applied on chain.' : '\nThe transaction was included but REJECTED. See rejectReason above.')
process.exit(ok ? 0 : 1)
