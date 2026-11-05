# 02. Buyer decision flow and the stub order store

Status: design only. Written 2026-11-05.

## How releases work today (facts from `server/agent.ts`)

`processAutoRelease()` reads the delivered orders, and once an order has been delivered for `AUTO_RELEASE_DELAY_SECONDS` (default 86400, 24 hours) it calls `confirmDelivery(bytes32)` through the Circle wallet. `readOrderFields()` decodes the order including `deliveryProof` and then discards it, so the proof is never read. Release is purely a timer.

## Design rule

The validator may only accelerate or flag. If anything about it is wrong or unavailable, the system behaves exactly as it does today. A validator problem must never block a payment or invent a new way to pay.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| RELEASE_NOW | Release before the timer, because the proof was independently validated |
| FLAG_FOR_REVIEW | Do not auto-release in the demo store; notify a human |
| DEFER_TO_TIMER | Ignore the validator for this order; today's timer applies |

## Flow, per delivered order

0. **Select.** Order is Delivered and not already decided for the pair (order key, `proofSha256`).
1. **Verify the validator.** It is pinned by config (`VALIDATOR_BADGE`, `TRUSTED_REGISTRY`, testnet `12802,0`). No discovery, no search. All five must hold:
   1. The agent exists in the trusted registry and `is_active` is true.
   2. `verify_agent_card` returns `match: true` (not `false`, not `null`).
   3. The card's badge extension names the same token address as `VALIDATOR_BADGE`.
   4. The card lists an `MCP` service with an https endpoint. That endpoint comes from the verified card, never from our env.
   5. `get_agent_wallet` returns a wallet. This is `registryWallet`.
   Results may be cached for 5 minutes. Re-verify when stale, always before paying.
2. **Guard the payment.** Before signing, check the 402 requirement: network is the testnet CAIP-2; scheme is `exact`; `payTo` equals `registryWallet` (never a wallet the card or server claims); asset is on the allowlist (default CCD); amount is at most `MAX_PRICE_MICRO_CCD`; `extra.feePayer` equals `ALLOWED_FEE_PAYER`; timeout is at most 120 s. Any failure: refuse to pay.
3. **Paid call.** Through the x402 MCP client. At most 2 paid attempts per (order, `proofSha256`), 30 s timeout each, result cached 1 hour so a retry never pays twice.
4. **Check the response.** `schemaVersion` is 1, `proofSha256` equals the hash we computed, and `orderRef` echoes. Otherwise treat the validator as untrusted.
5. **Decide** using the table below.

| Condition | Outcome |
| --- | --- |
| Step 1 fails | DEFER_TO_TIMER, alert |
| Step 2 refuses | DEFER_TO_TIMER, security alert |
| Call fails before settlement, after retry | DEFER_TO_TIMER |
| Paid but no usable result | DEFER_TO_TIMER, log `paid_no_result` |
| `pass` true, all required checks ok, none simulated | RELEASE_NOW |
| `pass` true with a simulated check | RELEASE_NOW in demo mode only (banner shown), DEFER_TO_TIMER otherwise |
| `pass` false and `retryable` | retry at +5 min and +30 min, then DEFER_TO_TIMER |
| `pass` false, not retryable | FLAG_FOR_REVIEW |
| kind `text` | FLAG_FOR_REVIEW, never RELEASE_NOW |

## Production path (the credible-path argument)

- **Phase A, shadow.** Log the validator verdict next to the timer decision. No effect on payments. This produces false-positive data.
- **Phase B, advisory.** `pass` can release early. `FLAG` only notifies and the timer still releases.
- **Phase C, optional.** Block the timer on `FLAG` for specific kinds, only after Phase A data supports it.

Two honest caveats:

- Early release shortens the dispute window the 24-hour timer gives today. Production needs a minimum hold (`MIN_HOLD_SECONDS`, value to be decided) and probably an opt-in.
- Format-only checks on local carriers will flag honest deliveries, which is why Phase B does not block.

## Stub order store

The demo never touches the mainnet escrow, Circle, or USDC.

- Lives in `concordium/src/store/`. In memory, seeded at start, snapshot to a gitignored `concordium/.data/` file.
- Interface: `listDelivered()`, `release(key)`, `flag(key, reason)`. Amounts are display strings. Nothing moves.
- Refuses to start if any of these env names is set: `CIRCLE_MAINNET_API_KEY`, `CIRCLE_MAINNET_ENTITY_SECRET`, `VITE_MAINNET_ESCROW_CONTRACT_ADDRESS`, `VITE_MAINNET_AGENT_WALLET_ID`, `VITE_MAINNET_AGENT_WALLET_ADDRESS`.
- No imports from `server/agent.ts`, `src/`, or any Arc RPC.

Seeded scenarios (what each proves):

| # | Proof | Expected outcome |
| --- | --- | --- |
| 1 | https link that loads | RELEASE_NOW |
| 2 | https link to an internal host | FLAG_FOR_REVIEW (BLOCKED_TARGET) |
| 3 | https link returning 404 | FLAG_FOR_REVIEW (UNREACHABLE) |
| 4 | valid IPFS CID that is retrievable | RELEASE_NOW |
| 5 | malformed IPFS CID | FLAG_FOR_REVIEW |
| 6 | UPS number the fixture marks delivered | RELEASE_NOW (demo mode, simulated banner) |
| 7 | tracking number not in the fixture | FLAG_FOR_REVIEW (NOT_CONFIRMED) |
| 8 | free-text note | FLAG_FOR_REVIEW (NOT_VERIFIABLE) |
| 9 | link that times out | retry, then DEFER_TO_TIMER |
| 10 | validator card tampered after pinning | DEFER_TO_TIMER (step 1) |
| 11 | server asks to be paid to the wrong wallet | DEFER_TO_TIMER (step 2) |
| 12 | validator revoked | DEFER_TO_TIMER (step 1) |

Scenarios 10 to 12 use a registry test double for the destructive cases and the real testnet registry for the happy path.

## Config names (names only, never values)

- Buyer: `CCD_PAYER_ADDRESS`, `CCD_PAYER_PRIVATE_KEY`, `VALIDATOR_BADGE`, `TRUSTED_REGISTRY`, `MAX_PRICE_MICRO_CCD`, `ALLOWED_FEE_PAYER`, `ALLOWED_ASSETS`, `MIN_HOLD_SECONDS`, `DEMO_MODE`, `CCD_NETWORK`.
- Validator service: `PORT`, `PAY_TO_ADDRESS`, `PRICE_MICRO_CCD`, `IPFS_GATEWAYS`, `DEMO_MODE`.
- Facilitator: `CCD_FACILITATOR_ADDRESS`, `CCD_FACILITATOR_PRIVATE_KEY`.
- One-off registration scripts: `CCD_OWNER_ADDRESS`, `CCD_OWNER_PRIVATE_KEY`.

Keys are testnet-only, one per role, and never reuse anything from the live JaraWork app. They go into `.env` or Render env vars by you, never into chat.
