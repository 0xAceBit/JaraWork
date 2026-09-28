/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc as arcBase } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Arc Mainnet — viem's arc entry has an empty rpcUrls array so we override it
const ARC_MAINNET_RPC = 'https://rpc.mainnet.arc.io'
const arc = {
  ...arcBase,
  rpcUrls: {
    default: { http: [ARC_MAINNET_RPC] as const },
    public:  { http: [ARC_MAINNET_RPC] as const },
  },
} as const

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, ARC_MAINNET_RPC)

export const config = createConfig({
  chains: [arc, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arc.id]: http(ARC_MAINNET_RPC),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
