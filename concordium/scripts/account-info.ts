/**
 * Read-only: show what a Concordium testnet account holds. No keys, no transactions.
 * Usage: node scripts/account-info.ts <base58-address>
 */
import { AccountAddress } from '@concordium/web-sdk'
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'

const input = process.argv[2]
if (!input) {
  console.error('usage: node scripts/account-info.ts <base58-address>')
  process.exit(2)
}

function bigintSafe(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

const host = process.env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com'
const port = Number(process.env.CCD_GRPC_PORT ?? 20000)
const client = new ConcordiumGRPCNodeClient(host, port, credentials.createSsl(), { timeout: 15_000 })

try {
  const address = AccountAddress.fromBase58(input)
  const info = await client.getAccountInfo(address)
  const credentialCount = Object.keys(info.accountCredentials).length
  console.log(
    JSON.stringify(
      {
        endpoint: `${host}:${port}`,
        address: info.accountAddress.address,
        nonce: String(info.accountNonce),
        ccdBalanceMicro: String(info.accountAmount.microCcdAmount),
        ccdBalance: Number(info.accountAmount.microCcdAmount) / 1_000_000,
        credentialCount,
        accountTokens: info.accountTokens ?? [],
      },
      bigintSafe,
      2,
    ),
  )
} catch (err) {
  console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2))
  process.exit(1)
}
