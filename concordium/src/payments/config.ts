/**
 * Payment configuration. The service is PAID by default and fails CLOSED: free verdicts are only
 * served when X402_MODE=free is set explicitly, and a paid service that is misconfigured refuses
 * to serve instead of silently falling back to free.
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
  ledgerFile: string
  /** True only if the operator declared the ledger file lives on durable storage. */
  ledgerDurable: boolean
}

type Env = Record<string, string | undefined>

function micro(env: Env, name: string, fallback: bigint): bigint {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${name} must be a whole number of microCCD.`)
  return BigInt(raw)
}

export type ServiceMode =
  | { mode: 'free' }
  | { mode: 'paid'; config: PaymentsConfig }
  | { mode: 'closed'; reason: string }

/** Builds the paid configuration, or throws a message that never contains a secret. */
export function loadPaymentsConfig(env: Env = process.env): PaymentsConfig {
  const key = (env.CCD_FACILITATOR_PRIVATE_KEY ?? env.CCD_SPONSOR_PRIVATE_KEY ?? '').trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('The facilitator key is missing or not 64 hex characters (value not shown).')
  }
  // The ledger holds the idempotency, replay and spend-cap state. A restart that wipes it can charge
  // the same request twice, so the operator must say where it lives, or accept the risk explicitly.
  const durable = env.X402_LEDGER_DURABLE === 'true'
  if (!durable && env.X402_ALLOW_EPHEMERAL_LEDGER !== 'true') {
    throw new Error('The payment ledger is not declared durable. Set X402_LEDGER_DURABLE=true if the ledger file is on persistent storage, or X402_ALLOW_EPHEMERAL_LEDGER=true to accept that a restart resets it.')
  }
  const estimatedSponsorFeeMicro = micro(env, 'ESTIMATED_SPONSOR_FEE_MICRO', 5_000_000n)
  return {
    network: CONCORDIUM_TESTNET_CAIP2,
    registryTokenAddress: env.REGISTRY_TOKEN_ADDRESS ?? 'JyP9YR6Wk3YPaGx3e8zyu',
    facilitatorAddress: env.CCD_FACILITATOR_ADDRESS ?? '3EZWRpdzPzi8WfsGRsiupiQEGZ6DjouZsANczD1uKEpkFL7qwc',
    facilitatorPrivateKey: key,
    grpcHost: env.CCD_GRPC_HOST ?? 'grpc.testnet.concordium.com',
    grpcPort: Number(env.CCD_GRPC_PORT ?? 20000),
    priceMicro: micro(env, 'PRICE_MICRO_CCD', (estimatedSponsorFeeMicro * 3n) / 2n),
    estimatedSponsorFeeMicro,
    payerDailyMaxMicro: micro(env, 'PAYER_DAILY_MAX_MICRO', 150_000_000n),
    sponsorDailyBudgetMicro: micro(env, 'SPONSOR_DAILY_BUDGET_MICRO', 250_000_000n),
    maxTimeoutSeconds: Number(env.X402_MAX_TIMEOUT_SECONDS ?? 60),
    ledgerFile: env.X402_LEDGER_FILE ?? '.data/payments.jsonl',
    ledgerDurable: durable,
  }
}

/**
 * Decides how the service behaves. Default is PAID. Free verdicts need X402_MODE=free on purpose.
 * Any problem with a paid setup yields 'closed' (the tool endpoint refuses), never 'free'.
 */
export function resolveServiceMode(env: Env = process.env): ServiceMode {
  const requested = (env.X402_MODE ?? '').trim().toLowerCase()
  if (requested === 'free') return { mode: 'free' }
  if (requested !== '' && requested !== 'paid') {
    return { mode: 'closed', reason: 'X402_MODE must be "paid" or "free".' }
  }
  try {
    return { mode: 'paid', config: loadPaymentsConfig(env) }
  } catch (error) {
    return { mode: 'closed', reason: error instanceof Error ? error.message : 'Paid mode could not be configured.' }
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
    ledgerDurable: String(c.ledgerDurable),
  }
}
