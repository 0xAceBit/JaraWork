# Run 10: fixes from the judge review (F1, F2, F3, F5, F6, F7)

Date: 2026-11-11. Branch: concordium-hackathon. The live JaraWork app and main were not touched.

## Did
- F1: cached verdicts need a verified signature, the original payer, and single use (src/payments/cachedReplay.ts, ledger.claimPayload).
- F2: paid by default; closed on any misconfiguration; free only with X402_MODE=free (src/payments/config.ts, server.mjs).
- F3: ledger path default and declared durability; buyer-side paid log (src/buyer/paidLog.ts).
- F5: non-answers are returned as errors so the wrapper cancels the payment (src/payments/chargeability.ts, paymentContext.ts).
- F6: the payer is built from the verified card endpoint (decide.ts payerFor).
- F7: the buyer recomputes the evidence hash (decide.ts).

## Verified
- 147 offline tests pass on Node 24 and Node 22.23.4; typecheck clean; lint 0 errors.
- Live testnet end-to-end run: 22 checks, 0 failures (trajectory/x402/e2e-2026-11-11T12-49-26-876Z.log). Includes the forged-payment attack (refused), the honest retry (served, not charged), malformed and inconclusive calls (not charged), and two settled payments reconciled from the chain.
- A first rerun had one failure caused by the hosted registry being unavailable; the buyer failed closed correctly. Added two short retries on that check and reran clean.

## Not done
- F3 real durability on the host (needs a persistent disk or database).
- F4 and F8 to F15 from docs/09.
