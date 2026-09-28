/**
 * One-shot script: create a Circle developer-controlled wallet on Arc Mainnet.
 * Run with: bun run scripts/create-mainnet-wallet.ts
 */
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const API_KEY       = process.env.CIRCLE_MAINNET_API_KEY ?? ''
const ENTITY_SECRET = process.env.CIRCLE_MAINNET_ENTITY_SECRET ?? ''

if (!API_KEY || !ENTITY_SECRET) {
  console.error('CIRCLE_MAINNET_API_KEY and CIRCLE_MAINNET_ENTITY_SECRET must be set in .env')
  process.exit(1)
}

const sdk = initiateDeveloperControlledWalletsClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET })

async function main() {
  // 1. Create wallet set
  console.log('Creating wallet set...')
  const wsRes = await sdk.createWalletSet({ name: 'JaraWork Mainnet Platform WalletSet' })
  const walletSetId = wsRes.data?.walletSet?.id ?? ''
  if (!walletSetId) throw new Error('Failed to create wallet set: ' + JSON.stringify(wsRes))
  console.log('Wallet set ID:', walletSetId)

  // 2. Create wallet on ARC (mainnet)
  console.log('Creating wallet on ARC mainnet...')
  const wRes = await sdk.createWallets({
    accountType: 'EOA',
    blockchains: ['ARC'],
    count: 1,
    walletSetId,
  })
  const wallet = wRes.data?.wallets?.[0]
  if (!wallet) throw new Error('Failed to create wallet: ' + JSON.stringify(wRes))

  console.log('\n✓ Mainnet agent wallet created!')
  console.log('─────────────────────────────────────')
  console.log('Wallet ID:     ', wallet.id)
  console.log('Wallet Set ID: ', walletSetId)
  console.log('Address:       ', wallet.address)
  console.log('─────────────────────────────────────')
  console.log('\nAdd these to Render env vars:')
  console.log(`VITE_MAINNET_AGENT_WALLET_ID=${wallet.id}`)
  console.log(`VITE_MAINNET_AGENT_WALLET_SET_ID=${walletSetId}`)
  console.log(`VITE_MAINNET_AGENT_WALLET_ADDRESS=${wallet.address}`)
  console.log(`\nThen call setPlatform(${wallet.address}) on the mainnet contract.`)
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
