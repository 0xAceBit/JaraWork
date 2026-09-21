/**
 * One-shot script: call setPlatform(agentWalletAddress) on JaraWorkEscrow
 * using the Circle deployer wallet (contract owner) via the SCP SDK.
 *
 * Run: bun run scripts/set-platform.ts
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const API_KEY       = process.env.CIRCLE_DEVELOPER_CONTROLLED_API_KEY ?? ''
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET ?? ''
const CONTRACT      = '0xd454036b54c5be123e2e3331fd9363df14400af5'
const AGENT_ADDRESS = '0xa7d90f5f3654a9d7da551fd24a4fba593a24fde6'
const DEPLOYER_WALLET_ID = '3c2464b2-8369-52e2-a782-800bbeca5396' // Circle platform deployer

if (!API_KEY || !ENTITY_SECRET) {
  console.error('CIRCLE_DEVELOPER_CONTROLLED_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env')
  process.exit(1)
}

const TERMINAL = new Set(['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED'])

async function main() {
  const sdk = initiateDeveloperControlledWalletsClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET })

  console.log(`Calling setPlatform(${AGENT_ADDRESS}) on ${CONTRACT}...`)

  const res = await sdk.createContractExecutionTransaction({
    walletId: DEPLOYER_WALLET_ID,
    contractAddress: CONTRACT,
    abiFunctionSignature: 'setPlatform(address)',
    abiParameters: [AGENT_ADDRESS],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  const txId = res.data?.id
  if (!txId) throw new Error(`No transaction ID returned: ${JSON.stringify(res)}`)
  console.log(`Transaction submitted: ${txId}`)
  console.log('Waiting for confirmation...')

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const poll = await sdk.getTransaction({ id: txId })
    const tx = poll.data?.transaction
    const state = tx?.state ?? ''
    process.stdout.write(`  state: ${state}\r`)
    if (TERMINAL.has(state)) {
      console.log(`\nFinal state: ${state}`)
      if (state === 'COMPLETE') {
        console.log(`✓ setPlatform succeeded! txHash: ${tx?.txHash ?? '(pending)'}`)
        console.log(`  Agent wallet ${AGENT_ADDRESS} is now the platform on ${CONTRACT}`)
        console.log(`  Explorer: https://explorer.testnet.arc.io/tx/${tx?.txHash}`)
      } else {
        console.error(`✗ Transaction ${state}. Check Circle dashboard for details.`)
        process.exit(1)
      }
      return
    }
  }
  throw new Error('Transaction did not settle in 3 minutes')
}

main().catch(e => { console.error(e); process.exit(1) })
