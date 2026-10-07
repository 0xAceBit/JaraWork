/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig, fallback } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc as arcBase } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Arc Mainnet — viem's arc entry has an empty rpcUrls array so we override it
// Multiple public Arc Mainnet RPCs — tested working, ordered by latency
const ARC_RPCS = [
  'https://rpc.mainnet.arc.io',            // Circle primary
  'https://rpc.quicknode.mainnet.arc.io',  // 70ms
  'https://rpc.drpc.mainnet.arc.io',       // 127ms
  'https://rpc.blockdaemon.mainnet.arc.io',// 482ms
  'https://rpc.nodeflare.app/arc/public',  // 504ms
] as const

const arc = {
  ...arcBase,
  rpcUrls: {
    default: { http: [...ARC_RPCS] as unknown as readonly [string, ...string[]] },
    public:  { http: [...ARC_RPCS] as unknown as readonly [string, ...string[]] },
  },
} as const

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, ARC_RPCS[0])

export const config = createConfig({
  chains: [arc, mainnet],
  connectors: [injected()],
  transports: {
    // fallback: try each RPC in order, move to next on timeout/error
    [arc.id]: fallback(
      ARC_RPCS.map(url => http(url, { timeout: 8_000, retryCount: 2, retryDelay: 500 }))
    ),
    [mainnet.id]: http(),
  },
  // Poll every 2s for receipts
  pollingInterval: 2_000,
})
