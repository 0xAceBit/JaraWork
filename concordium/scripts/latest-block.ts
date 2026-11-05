/**
 * Step A check: one read-only call to Concordium testnet.
 * Prints the latest finalized block. No keys, no transactions.
 *
 * Node setup the SDK needs (confirmed while writing this):
 *  - ESM ("type": "module") because @concordium/web-sdk is ES-module only.
 *  - The gRPC client for Node comes from the "@concordium/web-sdk/nodejs" subpath.
 *  - That client runs on @grpc/grpc-js, so TLS credentials come from credentials.createSsl().
 */
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs'

const host = process.env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com'
const port = Number(process.env.CCD_GRPC_PORT ?? 20000)

const client = new ConcordiumGRPCNodeClient(host, port, credentials.createSsl(), { timeout: 15_000 })
const status = await client.getConsensusStatus()
const block = await client.getBlockInfo(status.lastFinalizedBlock)

console.log(
  JSON.stringify(
    {
      endpoint: `${host}:${port}`,
      nodeRuntime: process.version,
      lastFinalizedBlockHash: String(status.lastFinalizedBlock),
      lastFinalizedBlockHeight: String(status.lastFinalizedBlockHeight),
      blockSlotTime: block.blockSlotTime.toISOString(),
      protocolVersion: String(status.protocolVersion),
      genesisBlockHash: String(status.genesisBlock),
    },
    null,
    2,
  ),
)
