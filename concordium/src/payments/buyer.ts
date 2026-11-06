/**
 * The buyer: pays for validate_delivery_proof over x402, but only on its own terms.
 * Before signing it re-reads the payee from the registry (chain) and refuses unless the network,
 * asset, amount, payee and fee payer all match policy. Spend caps are enforced here too.
 */
import { AccountAddress, buildBasicAccountSigner } from '@concordium/web-sdk'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { ExactConcordiumScheme } from '@x402/concordium/exact/client'
import type { Network } from '@x402/core/types'
import { createx402MCPClient } from '@x402/mcp'
import { resolvePayee } from '../registry/resolvePayee.ts'

export interface BuyerPolicy {
  network: Network
  registryTokenAddress: string
  allowedFeePayer: string
  maxPerPaymentMicro: bigint
  dailyMaxMicro: bigint
}

export interface BuyerConfig {
  url: URL
  payerAddress: string
  payerPrivateKey: string
  policy: BuyerPolicy
  /** Optional hook to observe raw HTTP traffic (the e2e test uses it to capture a signed payment). */
  fetch?: typeof fetch
}

export interface BuyerResult {
  verdict: Record<string, unknown> | null
  paymentMade: boolean
  settlement: Record<string, unknown> | null
  refusedByBuyer: string | null
  isError: boolean
  raw: unknown
}

export type BuyerLog = (event: string, data: Record<string, unknown>) => void

export async function createBuyer(config: BuyerConfig, log: BuyerLog) {
  let spentMicro = 0n
  let refusal: string | null = null
  let approvedAmount = 0n
  const { policy } = config

  async function check(accept: { scheme: string; network: string; asset: string; amount: string; payTo: string; extra?: Record<string, unknown> }): Promise<string | null> {
    if (accept.scheme !== 'exact') return `scheme ${accept.scheme} is not exact`
    if (accept.network !== policy.network) return `network ${accept.network} is not ${policy.network}`
    if (accept.asset !== 'CCD') return `asset ${accept.asset} is not CCD`
    if (BigInt(accept.amount) > policy.maxPerPaymentMicro) return `amount ${accept.amount} is above the per-payment cap ${policy.maxPerPaymentMicro}`
    if (spentMicro + BigInt(accept.amount) > policy.dailyMaxMicro) return 'the daily cap would be exceeded'
    if (accept.extra?.feePayer !== policy.allowedFeePayer) return `fee payer ${String(accept.extra?.feePayer)} is not the allowed sponsor`
    const payee = await resolvePayee(policy.registryTokenAddress)
    if (!payee.ok) return `could not confirm the payee from the registry: ${payee.code}`
    if (accept.payTo !== payee.wallet) return `server asks to be paid at ${accept.payTo} but the registry says ${payee.wallet}`
    return null
  }

  const client = createx402MCPClient({
    name: 'jarawork-buyer',
    version: '0.1.0',
    schemes: [
      {
        network: policy.network,
        client: new ExactConcordiumScheme({
          accountAddress: AccountAddress.fromBase58(config.payerAddress),
          signer: buildBasicAccountSigner(config.payerPrivateKey),
        }),
      },
    ],
    autoPayment: true,
    onPaymentRequested: async ({ paymentRequired }) => {
      for (const accept of paymentRequired.accepts) {
        const problem = await check(accept)
        if (problem !== null) {
          refusal = problem
          log('buyer.refused', { reason: problem })
          return false
        }
      }
      approvedAmount = BigInt(paymentRequired.accepts[0]?.amount ?? '0')
      log('buyer.approved', { terms: paymentRequired.accepts[0] })
      return true
    },
  })
  await client.connect(new StreamableHTTPClientTransport(config.url, config.fetch ? { fetch: config.fetch } : {}))

  return {
    spentMicro: (): bigint => spentMicro,
    async validate(proof: string, orderRef?: string): Promise<BuyerResult> {
      refusal = null
      let result: Awaited<ReturnType<typeof client.callTool>>
      try {
        result = await client.callTool('validate_delivery_proof', orderRef === undefined ? { proof } : { proof, orderRef })
      } catch (error) {
        // The SDK throws when our own policy denies the payment; report that as a refusal, not a crash.
        if (refusal !== null) {
          return { verdict: null, paymentMade: false, settlement: null, refusedByBuyer: refusal, isError: true, raw: String(error) }
        }
        throw error
      }
      const structured = (result as { structuredContent?: unknown }).structuredContent
      const settlement = (result.paymentResponse ?? null) as Record<string, unknown> | null
      if (result.paymentMade && settlement?.success === true && settlement.cached !== true) {
        spentMicro += approvedAmount
      }
      return {
        verdict: result.isError ? null : ((structured ?? null) as Record<string, unknown> | null),
        paymentMade: result.paymentMade,
        settlement,
        refusedByBuyer: refusal,
        isError: Boolean(result.isError),
        raw: result,
      }
    },
    close: () => client.close(),
  }

}
