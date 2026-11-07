# Run 08: x402 paywall (prompt 6), built up to the first live payment

Date: 2026-11-06. Branch: concordium-hackathon. Paid mode is OFF unless X402_ENABLED=true.

## Did
- Recorded decisions A to G (docs/08). Accounts: payer 3HKu4..., payee 47rTd... (registry agentWallet), sponsor 3EZWR....
- src/payments: config, ledger (one payment per request id, replay protection, daily caps, stale in-flight handling), accounting (summary cost cross-checked with balances), facilitator (in-process, official @x402/concordium), paymentContext (x402 over MCP, native CCD), buyer (policy: network, asset, amount, fee payer, payee re-read from the registry), requestId.
- scripts/x402-e2e.ts: hostile buyers, paid calls, retry, cap, replay, reconciliation, with logs in trajectory/x402/.

## Verified
- 83 tests pass on Node 24 and Node 22.23.4. Typecheck and lint clean.
- Paid mode started locally against live testnet: payee read from the chain (47rTd...), sponsor 3EZWR..., price 6,000,000 microCCD.
- An unpaid call returns x402 version 2 requirements: exact, ccd:4221332d..., CCD, payTo = registry wallet, feePayer = sponsor, timeout 60.
- The buyer refuses a price above its cap (seen in the first e2e run).

## Found
- The e2e preflight stopped the run: CCD_PAYER_PRIVATE_KEY held the OWNER key (47rTd...), not the payer's. Preflight now aborts before any money can move.
- The SDK throws when a buyer policy denies a payment; the buyer now reports it as a refusal.
- Testnet fee rate is 7,539 microCCD per energy unit, so a sponsored transfer costs about 2.3 to 3.8 CCD.

## Not yet done / assumed
- No payment has settled yet: waiting for the payer's real key (account 3HKu4...).
- Fee split between sponsor and buyer in a sponsored transaction is UNVERIFIED until the first settlement; the accounting cross-checks two sources and reports 'unverified' if they disagree.
- Ledger is a file on Render's ephemeral disk, so it resets on redeploy. A database is the production step.

## Result (2026-11-07): end-to-end test passed, 16 of 16 checks, 0 failures
- Settled sponsored payments on testnet, for example 950b44e8616fb962... and 33d6a990e7b42b60.... Buyer paid exactly 7,500,000 microCCD each, buyer fee 0, sponsor fee 4,991,315 each; summary and balances agree.
- Three hostile buyers refused with no money moved (price over cap, payee differs from the registry wallet, fee payer not allowed).
- A retry returned the stored verdict with no second charge; a third payment hit the payer daily cap; a replayed signed payment got no verdict and no charge.
- Bugs found by the test and fixed: payer read from the wrong payload field, SDK throws on a policy denial, SDK needs CCD allowed explicitly, sponsor fee lives in sponsor.cost, SDK returns fee amounts as objects.
- 88 tests pass on Node 24 and Node 22.23.4. Full logs: trajectory/x402/.
- Still off on Render: X402_ENABLED is not set there, so the public tool is free until you decide to enable it.
