/**
 * In-process x402 facilitator for Concordium (self-facilitation): verifies the buyer's partially
 * signed sponsored transaction, adds the sponsor signature, submits it and waits for finality.
 * The sponsor key is read from config and never logged.
 */
import { toConcordiumFacilitatorSigner } from '@x402/concordium'
import { ExactConcordiumScheme } from '@x402/concordium/exact/facilitator'
import { x402Facilitator } from '@x402/core/facilitator'
import type { FacilitatorClient } from '@x402/core/server'
import type { SupportedResponse } from '@x402/core/types'
import type { PaymentsConfig } from './config.ts'

export interface InProcessFacilitator {
  facilitator: x402Facilitator
  client: FacilitatorClient
}

export function createFacilitator(config: PaymentsConfig): InProcessFacilitator {
  const signer = toConcordiumFacilitatorSigner(config.facilitatorAddress, config.facilitatorPrivateKey, {
    host: config.grpcHost,
    port: config.grpcPort,
    useTls: true,
  })
  const scheme = new ExactConcordiumScheme({
    signer,
    requireFinalization: true,
    finalizationTimeoutMs: 60_000,
    maxExpiryOffsetSeconds: config.maxTimeoutSeconds,
  })
  const facilitator = new x402Facilitator().register(config.network, scheme)
  const client: FacilitatorClient = {
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
    // Same shape at runtime; the facilitator types network ids as plain string.
    getSupported: () => Promise.resolve(facilitator.getSupported() as SupportedResponse),
  }
  return { facilitator, client }
}
