/**
 * Payment configuration. Paid mode is OFF unless X402_ENABLED=true, so the public service
 * keeps working as a free demo until the sponsor key is set on the host.
 * The facilitator key comes only from the environment and is never logged.
 * Amounts are whole microCCD (1 CCD = 1,000,000). Defaults follow docs/08: a sponsored
 * transfer is estimated at 4 CCD; price = 1.5x that. Re-measure on the first settled payment.
 */
import { CONCORDIUM_TESTNET_CAIP2 } from '@x402/concordium'
import type { Network } from '@x402/core/types'

export interface PaymentsConfig {
  network: Network
  /** Registry token whose agentWallet is the payee. The server pays only what the chain says. */
  registryTokenAddress: string
  facilitatorAddress: string
  facilitatorPrivateKey: string
  grpcHost: string
  grpcPort: number
  priceMicro: bigint
  estimatedSponsorFeeMicro: bigint
  payerDailyMaxMicro: bigint
  sponsorDailyBudgetMicro: bigint
  maxTimeoutSeconds: number
  ledgerFile: string | null
}

type Env = Record<string, string | undefined>

function micro(env: Env, name: string, fallback: bigint): bigint {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${name} must be a whole number of microCCD.`)
  return BigInt(raw)
}

export function loadPaymentsConfig(env: Env = process.env): PaymentsConfig | null {
  if (env.X402_ENABLED !== 'true') return null
  const key = (env.CCD_FACILITATOR_PRIVATE_KEY ?? env.CCD_SPONSOR_PRIVATE_KEY ?? '').trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('X402_ENABLED is true but the facilitator key is missing or not 64 hex characters (value not shown).')
  }
  const estimatedSponsorFeeMicro = micro(env, 'ESTIMATED_SPONSOR_FEE_MICRO', 4_000_000n)
  return {
    network: CONCORDIUM_TESTNET_CAIP2 as Network,
    registryTokenAddress: env.REGISTRY_TOKEN_ADDRESS ?? 'JyP9YR6Wk3YPaGx3e8zyu',
    facilitatorAddress: env.CCD_FACILITATOR_ADDRESS ?? '3EZWRpdzPzi8WfsGRsiupiQEGZ6DjouZsANczD1uKEpkFL7qwc',
    facilitatorPrivateKey: key,
    grpcHost: env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com',
    grpcPort: Number(env.CCD_GRPC_PORT ?? 20000),
    priceMicro: micro(env, 'PRICE_MICRO_CCD', (estimatedSponsorFeeMicro * 3n) / 2n),
    estimatedSponsorFeeMicro,
    payerDailyMaxMicro: micro(env, 'PAYER_DAILY_MAX_MICRO', 120_000_000n),
    sponsorDailyBudgetMicro: micro(env, 'SPONSOR_DAILY_BUDGET_MICRO', 200_000_000n),
    maxTimeoutSeconds: Number(env.X402_MAX_TIMEOUT_SECONDS ?? 60),
    ledgerFile: env.X402_LEDGER_FILE ?? null,
  }
}

/** Safe to show anywhere: no key, no secrets. */
export function describeConfig(c: PaymentsConfig): Record<string, string | number> {
  return {
    network: c.network,
    asset: 'CCD',
    priceMicroCcd: c.priceMicro.toString(),
    facilitatorAddress: c.facilitatorAddress,
    registryTokenAddress: c.registryTokenAddress,
    payerDailyMaxMicro: c.payerDailyMaxMicro.toString(),
    sponsorDailyBudgetMicro: c.sponsorDailyBudgetMicro.toString(),
    maxTimeoutSeconds: c.maxTimeoutSeconds,
  }
}
