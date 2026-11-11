/**
 * Paid mode for the validator tool: x402 over MCP, native CCD, sponsored fees.
 * Order of events (authorization flow): payment verified -> ledger checks (replay, one payment
 * per request id, spend caps) -> tool runs -> settlement -> accounting recorded from chain evidence.
 * The payee is whatever the registry says (resolvePayee); nothing in config can override it.
 */
import type { ConcordiumGRPCNodeClient } from '@concordium/web-sdk/nodejs'
import { ExactConcordiumScheme } from '@x402/concordium/exact/server'
import type { PaymentPayload } from '@x402/core/types'
import { createPaymentWrapper, x402ResourceServer } from '@x402/mcp'
import { resolvePayee } from '../registry/resolvePayee.ts'
import { canonicalJson, sha256Hex } from '../service/evidence.ts'
import type { ToolHandler, ToolWrap } from '../service/mcp.ts'
import { readBalances, readSummaryCosts, reconcile } from './accounting.ts'
import { authorizeCachedResult } from './cachedReplay.ts'
import { isNonAnswer } from './chargeability.ts'
import type { Balances } from './accounting.ts'
import type { PaymentsConfig } from './config.ts'
import { createFacilitator } from './facilitator.ts'
import { PaymentLedger } from './ledger.ts'
import type { PaymentRecord } from './ledger.ts'
import { describeRequest } from './requestId.ts'

export type PaymentLog = (event: string, data: Record<string, unknown>) => void

export interface PaymentContext {
  wrap: ToolWrap
  ledger: PaymentLedger
  payTo: string
  /** Public facts only: no keys. */
  status: () => Record<string, unknown>
}

const defaultLog: PaymentLog = (event, data) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }))
const payloadHashOf = (p: PaymentPayload): string => sha256Hex(canonicalJson(p.payload))
/**
 * The payer is inside the signed transaction. (The package docs show a top-level `sender` in the payload;
 * the real client does not send one, so reading it there returned an empty string.)
 */
const senderOf = (p: PaymentPayload): string => {
  const tx = p.payload.signedTransaction as { header?: { sender?: unknown } } | undefined
  return typeof tx?.header?.sender === 'string' ? tx.header.sender : ''
}

export async function createPaymentContext(config: PaymentsConfig, chain: ConcordiumGRPCNodeClient, log: PaymentLog = defaultLog): Promise<PaymentContext> {
  const payee = await resolvePayee(config.registryTokenAddress)
  if (!payee.ok) throw new Error(`Paid mode refused to start: ${payee.reason}`)
  const payTo = payee.wallet
  const sponsor = config.facilitatorAddress

  const { facilitator, client } = createFacilitator(config)
  const ledger = new PaymentLedger(config, config.ledgerFile)
  facilitator.onSettleFailure((context) => {
    const key = payloadHashOf(context.paymentPayload)
    if (ledger.all().some((r) => r.payloadHash === key && r.status === 'verified')) ledger.failed(key, 'settlement failed')
    log('x402.settle_failed', { payloadHash: key })
    return Promise.resolve()
  })

  const resourceServer = new x402ResourceServer(client)
  resourceServer.register(config.network, new ExactConcordiumScheme())
  await resourceServer.initialize()
  const accepts = await resourceServer.buildPaymentRequirements({
    scheme: 'exact',
    network: config.network,
    payTo,
    price: { amount: config.priceMicro.toString(), asset: 'CCD' },
    maxTimeoutSeconds: config.maxTimeoutSeconds,
  })

  const pending = new Map<string, { before: Balances; result?: Record<string, unknown> }>()
  const hooks = {
    onBeforeExecution: async ({ arguments: args, paymentPayload, paymentRequirements }: { arguments: Record<string, unknown>; paymentPayload: PaymentPayload; paymentRequirements: { amount: string } }): Promise<boolean> => {
      const facts = describeRequest(args)
      const payer = senderOf(paymentPayload)
      if (payer === '') {
        log('x402.refused', { why: 'the payer could not be identified from the signed transaction' })
        return false
      }
      const payloadHash = payloadHashOf(paymentPayload)
      const outcome = ledger.begin({ ...facts, payer, payTo, amountMicro: BigInt(paymentRequirements.amount), payloadHash })
      if (outcome.kind !== 'new') {
        log('x402.refused', { requestId: facts.requestId, payer, why: outcome.kind === 'rejected' ? outcome.code : outcome.kind })
        return false
      }
      pending.set(payloadHash, { before: await readBalances(chain, [payer, payTo, sponsor]) })
      log('x402.verified', { requestId: facts.requestId, payer, payTo, amountMicro: paymentRequirements.amount })
      return true
    },
    onAfterExecution: ({ paymentPayload, result }: { paymentPayload: PaymentPayload; result: { content: { type: string; text?: string }[]; isError?: boolean } }): Promise<void> => {
      const entry = pending.get(payloadHashOf(paymentPayload))
      if (result.isError === true) {
        // No answer was produced, so the wrapper cancels the payment. Close the ledger entry so the id is free again.
        pending.delete(payloadHashOf(paymentPayload))
        ledger.failed(payloadHashOf(paymentPayload), 'no answer was produced; the payment was not charged')
        log('x402.not_charged', { payloadHash: payloadHashOf(paymentPayload) })
        return Promise.resolve()
      }
      const text = result.content.find((part) => part.type === 'text')?.text
      if (entry && text !== undefined) {
        try {
          entry.result = JSON.parse(text) as Record<string, unknown>
        } catch {
          // The verdict is always JSON; if it somehow is not, the ledger simply keeps no stored result.
        }
      }
      return Promise.resolve()
    },
    onAfterSettlement: async ({ paymentPayload, settlement }: { paymentPayload: PaymentPayload; settlement: { transaction: string } }): Promise<void> => {
      const key = payloadHashOf(paymentPayload)
      const entry = pending.get(key)
      if (!entry) return
      pending.delete(key)
      const payer = senderOf(paymentPayload)
      const after = await readBalances(chain, [payer, payTo, sponsor])
      const cost = await readSummaryCosts(chain, settlement.transaction).catch((error: unknown) => {
        log('x402.summary_unreadable', { txHash: settlement.transaction, error: String(error).slice(0, 160) })
        return null
      })
      const accounting = reconcile({ before: entry.before, after, priceMicro: config.priceMicro, payer, payTo, sponsor, summaryCostMicro: cost?.sponsorMicro ?? null, senderCostMicro: cost?.senderMicro ?? null })
      ledger.settled(key, { txHash: settlement.transaction, accounting, result: entry.result ?? null })
      log('x402.settled', { txHash: settlement.transaction, payer, accounting })
    },
  }

  const wrap: ToolWrap = (handler) => {
    const paid = createPaymentWrapper(resourceServer, {
      accepts,
      hooks,
      resource: { url: 'mcp://tool/validate_delivery_proof', description: 'Validate one delivery proof', mimeType: 'application/json' },
    })
    const paidHandler = paid(async (args: Record<string, unknown>) => {
      const result = await handler(args as { proof: string; orderRef?: string }, undefined)
      // A result that is not an answer is returned as an error, so the payment is cancelled instead of settled.
      return isNonAnswer(result.structuredContent) ? { ...result, isError: true } : result
    })
    return async (args, extra) => {
      const facts = describeRequest(args)
      const attached = (extra as { _meta?: Record<string, unknown> } | undefined)?._meta?.['x402/payment'] as PaymentPayload | undefined
      // A retry by the paying buyer gets the stored verdict with no second charge. The attached payment is
      // never trusted by what it says: it must pass the facilitator's signature check and can be used only once.
      const decision = await authorizeCachedResult({
        prior: ledger.find(facts.requestId),
        proofSha256: facts.proofSha256,
        attached,
        verify: async (payload) => {
          const checked = await client.verify(payload as PaymentPayload, accepts[0])
          return { isValid: checked.isValid, ...(typeof checked.payer === 'string' ? { payer: checked.payer } : {}) }
        },
        senderOf: (payload) => senderOf(payload as PaymentPayload),
        claim: (payload) => ledger.claimPayload(payloadHashOf(payload as PaymentPayload)),
      })
      if (decision.serve) {
        const stored = (decision.record.result ?? {}) as Record<string, unknown>
        log('x402.cached', { requestId: facts.requestId, payer: decision.record.payer })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(stored) }],
          structuredContent: stored,
          _meta: { 'x402/payment-response': { success: true, transaction: decision.record.txHash, network: config.network, payer: decision.record.payer, cached: true } },
        }
      }
      if (attached !== undefined && ledger.find(facts.requestId)?.status === 'settled') {
        log('x402.cache_refused', { requestId: facts.requestId, why: decision.why })
      }
      return (await paidHandler(args, extra)) as unknown as Awaited<ReturnType<ToolHandler>>
    }
  }

  const status = (): Record<string, unknown> => ({
    enabled: true,
    mode: 'paid',
    ledgerDurable: config.ledgerDurable,
    network: config.network,
    asset: 'CCD',
    priceMicroCcd: config.priceMicro.toString(),
    payTo,
    payToSource: 'registry agentWallet read from chain',
    sponsor,
    payments: ledger.all().length,
  })

  log('x402.ready', status())
  return { wrap, ledger, payTo, status }
}
