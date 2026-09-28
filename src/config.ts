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
const ARC_MAINNET_RPC   = 'https://rpc.mainnet.arc.io'
const ARC_MAINNET_RPC_2 = 'https://rpc.arc.io'

const arc = {
  ...arcBase,
  rpcUrls: {
    default: { http: [ARC_MAINNET_RPC, ARC_MAINNET_RPC_2] as const },
    public:  { http: [ARC_MAINNET_RPC, ARC_MAINNET_RPC_2] as const },
  },
} as const

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, ARC_MAINNET_RPC)

export const config = createConfig({
  chains: [arc, mainnet],
  connectors: [injected()],
  transports: {
    // fallback: try primary RPC first, fall back to secondary if it fails/times out
    [arc.id]: fallback([
      http(ARC_MAINNET_RPC,   { timeout: 10_000, retryCount: 3, retryDelay: 1_000 }),
      http(ARC_MAINNET_RPC_2, { timeout: 10_000, retryCount: 3, retryDelay: 1_000 }),
    ]),
    [mainnet.id]: http(),
  },
  // Poll every 2s for receipts — fast enough without hammering the RPC
  pollingInterval: 2_000,
})
