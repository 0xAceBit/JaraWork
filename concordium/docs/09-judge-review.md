# 09. Judge review: integration depth and credible path to production

Date: 2026-11-07. Scope: concordium/ on branch concordium-hackathon at 88be158, plus the demo logs in trajectory/. Report only: nothing was fixed.
Evidence labels: **RAN** executed by the reviewer, **LOG** shown in the demo logs, **CODE** read from the source, **UNVERIFIED** suspected, not proven.

## What is genuinely strong
- A real agent registered on Concordium testnet (token 1008) with a valid badge: `check_badge` returns `badge_valid: true`, 15 of 15 checks. (RAN, earlier)
- Real sponsored x402 payments settled on testnet, with the buyer's fee 0 and the sponsor's fee read from the chain's own summary and cross-checked against balances. (LOG)
- A suspicious buyer: three hostile policies refused before any money moved. (LOG)
- Honest labelling: `simulated: true` on every stubbed answer, a card that says "work in progress", and docs that record where Concordium's own pages conflict.
- 117 tests, clean typecheck, 0 lint errors, run on Node 24 and the Node 22 that Render uses.

## Ranked findings

| # | Sev | Finding | Evidence |
|---|---|---|---|
| 1 | HIGH | A verdict can be obtained without paying: the cached-result path trusts an unsigned payment | RAN |
| 2 | HIGH | The public service does not charge at all today, and it fails open if the flag is forgotten | RAN |
| 3 | HIGH | Idempotency, replay and spend-cap state is in memory by default and lost on every restart or sleep | CODE |
| 4 | HIGH | What is being sold is mocked: carrier, link and IPFS checks are fixtures | RAN, CODE |
| 5 | HIGH | The buyer is charged for non-answers, and a non-answer is cached forever under that request id | CODE |
| 6 | MED | The URL the buyer pays is never tied to the endpoint the card vouches for | CODE |
| 7 | MED | The evidence hash is never recomputed by the buyer, and verdicts are unsigned | CODE |
| 8 | MED | "Chain wins" really means "Concordium's hosted indexer wins" | CODE |
| 9 | MED | The facilitator runs inside the service being paid, with the sponsor's hot key in its environment | CODE |
| 10 | MED | No rate limiting or authentication on `/mcp`; sponsor-budget griefing is possible | CODE, UNVERIFIED |
| 11 | MED | The demo shows replay stopped by the chain, not by our ledger | LOG |
| 12 | MED | Concordium's identity layer (zero-knowledge proofs) and stablecoins are not used | CODE |
| 13 | MED | Several documented controls do not exist in code | CODE |
| 14 | MED | The owner key is also the payee and the identity controller | CODE |
| 15 | LOW | Status route discloses spend, proofs go to a third party in full, free-tier sleep, test gaps | CODE |

## 1. Mocked or superficial Concordium components

**F4 (HIGH, RAN/CODE). The paid-for service is a stub.** Carrier status, link reachability and IPFS retrieval come from fixture tables (`src/service/probes.ts`). A tracking number in the table is always "delivered", any `example.com` link is always "reachable", and two named CIDs are always "retrievable". A judge asking "why would anyone pay for this?" gets: format checks only. The `simulated: true` flag is honest, but it is self-reported by the validator and the buyer believes it. In demo mode a simulated pass releases funds.

**F12 (MED, CODE). The Concordium depth is registry plus a sponsored transfer.** Real and verifiable: registration, badge, sponsored CCD transfers, chain-checked fee accounting. Not used: Concordium's zero-knowledge identity proofs (the differentiator), stablecoin tokens (PLT), the Validation or Reputation registries described in ERC-8004. The how-to page's identity-proof step was deliberately skipped because nothing specifies it.

**F8 (MED, CODE). "Chain wins" is "the hosted indexer wins".** `resolvePayee`, `is_active`, the agent lookup and the card check all come from Concordium's hosted registry service. The buyer never reads the registry contract from a node itself. One third party is trusted for identity and for the payee.

**F9 (MED, CODE). The facilitator verifies its own payments.** It runs inside the validator service, owned by the party being paid, and the sponsor's private key sits in that public process's environment. "The facilitator verifies" is self-attestation. The spec's separation rule (sponsor is not the sender) is respected, but there is no independent party in the loop.

## 2. Validated without paying, or paid without validating

**F1 (HIGH, RAN). Free verdicts through the cache path.** `paymentContext.ts` returns a stored verdict when `senderOf(attachedPayment) === prior.payer`, reading the sender out of the payment **without verifying its signature**. Reproduced on a copy of the demo ledger: a request with no payment was refused, a forged payment naming a different account was refused, and a forged payment that only names the real payer returned `pass/OK` and also leaked the real settlement transaction hash. The attacker needs the payer's public address, the order reference and the exact proof. The payer address and the transaction hash are public on chain.

**F2 (HIGH, RAN). The public deployment is free.** `GET /x402/status` on the live service returns `{"enabled":false}`, and an unpaid call to `/mcp` returns a full verdict. The x402 integration exists only in the local runs shown in the logs. It is also **fail-open**: the paid mode is on only if `X402_ENABLED=true`, so forgetting the variable silently serves everything free.

**F5 (HIGH, CODE). Paying for non-answers.** The tool returns normally for malformed input, an unavailable carrier and an inconclusive check. The payment wrapper settles after any return that did not throw, and the ledger stores that non-answer under the request id. The buyer is charged 7.5 CCD and a retry returns the cached non-answer, so the id can never get a real answer. Not executed (it would spend testnet CCD); the logs only contain paid passes.

**F6 (MED, CODE). Verified one endpoint, paid another.** `verifyValidator` receives `serviceUrl` as a parameter and the payer is built separately, and `VerifiedValidator.endpoint` is never used. A misconfigured buyer verifies server A and pays server B. The payee check still pins the recipient to the registry wallet, which limits the damage.

## 3. Replay and double-payment holes

**F3 (HIGH, CODE). State lives in memory.** `X402_LEDGER_FILE` defaults to `null` (`config.ts`), so one-payment-per-request, replay and the daily caps are in-process only. If it is set, it is a file on Render's ephemeral disk. A restart or a free-tier sleep clears them: the same request id can be charged twice, the caps reset, and cached results vanish. After a restart only the chain's nonce check and the 60-second expiry protect against replay. The buyer side keeps no memory either, and the stub store is in memory.

**F11 (MED, LOG). The demo's replay was stopped by the chain.** The log shows the replay refused but no `x402.refused` line from our ledger, so the facilitator's nonce check caught it. Our own `PAYLOAD_REPLAYED` rule is covered by unit tests only. The payload hash is over canonical JSON of the whole payload, so an added field changes it while the chain still sees the same transaction.

**F10 (MED, CODE/UNVERIFIED). No rate limit or authentication on `/mcp`.** Each bogus payment triggers outbound node calls. Separately, I could not confirm whether a payment that passes verification but fails on chain (for example the payer empties the account in between) charges the sponsor a fee. If it does, the sponsor budget can be drained by griefing.

## 4. README and documentation claims the code does not support
- `docs/01` and `docs/04` specify reachability with an SSRF guard: no such code exists. The README is honest that these checks are planned.
- `docs/02` lists `MIN_HOLD_SECONDS`, `ALLOWED_ASSETS`, a 5-minute validator-verification cache, and taking the endpoint from the verified card instead of config. None exist in code.
- The "shadow" and "advisory" rollout phases and the Bun agent hook are documentation only. No deployed buyer exists, and the escrow agent does not call this code.
- README: "Before paying anything it verifies the validator" is true for the library and tests, not for a deployed system.
- The card has no `services` or `x402Support`, so the buyer refuses our own validator live (RAN earlier).

**F7 (MED, CODE). The evidence hash proves nothing to the buyer.** `integrityProblem` in `src/buyer/decide.ts` checks only that the hash is 64 hex characters. The buyer never recomputes it, and the verdict is unsigned. The tests show a flipped check breaks the hash, but only for someone who recomputes. A lying or compromised validator is undetectable.

**F13 (MED, CODE).** See the bullets above for documented controls that do not exist.

**F14 (MED, CODE). One key does three jobs.** The owner key `47rTd…` controls the agent NFT (transfer, URI, wallet), is the payee, and is the account used for registration. Compromise of that one key loses the identity and the income together. The sponsor key is a plain environment variable visible to anyone with Render workspace access. The payer key sits in a sandbox `.env`. During development a wrong key was pasted twice before a check caught it.

**F15 (LOW).** `/x402/status` discloses payee, sponsor and ledger totals. The buyer sends the full proof string, including the free-text `note`, and the order reference to a third party. The free tier sleeps, and the badge check fails while it sleeps (observed). The payment hooks have no unit tests, only the paid end-to-end run, which spends real CCD and is not part of the normal suite. The forged-cache path in F1 was untested.

## 5. What production still needs
- **Key custody:** a secrets manager or KMS, not environment variables; separate cold owner, hot sponsor (low balance, capped top-up), payee and payer keys; rotation; no keys in dev sandboxes.
- **Validator reputation:** nothing records whether a validator was right. Needs signed verdicts or attestations, feedback tied to evidence hashes, more than one validator with quorum, stake or slashing, and SLA tracking. A badge shows identity, not quality.
- **Disputes:** a flagged order goes nowhere (the store is a stub). Needs a human review queue, refunds for non-answers, an appeal path, and the existing Arc dispute mechanism consuming the evidence hash.
- **Mainnet:** every constant is testnet (network id, registry contract, node endpoints, genesis). Mainnet needs its own registry address, a real fee and pricing model (CCD price moves), sponsor onboarding, real carrier and link checks, an always-on host with a database, rate limits, and an independent security review.
- **Arc and Concordium reconciliation:** nothing links an Arc order (USDC) to a Concordium payment (CCD). Open: who holds and funds CCD, how treasury converts, how the fee is allocated against the platform's 2.5 percent, how a paid-but-not-released or released-but-not-paid case is detected and repaired (an outbox or saga with a durable record), and a reconciliation job across the ledger, the chain and Arc. The escrow agent hook (about 20 lines) is a proposal in `docs/03`, not code.

## Overall
Integration depth is strong and verifiable where it is real: registry, badge, sponsored payments, chain-checked accounting, hostile-buyer refusals. It is weak on the value being sold and on production readiness. The most damaging items for a judge are the free-verdict forgery (F1), the public service not charging (F2), the memory-only ledger (F3), and the stubbed core (F4). F1 and F3 are cheap to fix, F2 is one environment variable plus a fail-closed default, and F4 is the real work.

## Fix status (2026-11-11)

| # | Status | What changed | Proof |
|---|---|---|---|
| F1 | Fixed | A stored verdict is served only if the attached payment passes the facilitator's real signature check, names the original payer, and is used once. | Live: forged request refused ("the attached payment is not valid"); honest retry served and not charged. |
| F2 | Fixed | The service is paid by default. Free needs `X402_MODE=free`. Any paid misconfiguration closes `/mcp` with a 503 and says why on `/x402/status`; the card and `/health` stay up. | Unit tests; closed server test. |
| F3 | Partly fixed | The ledger always has a file path, a paid service must declare its durability (`X402_LEDGER_DURABLE=true`, or accept the risk with `X402_ALLOW_EPHEMERAL_LEDGER=true`), and the buyer now keeps its own paid log so a restart cannot make it pay twice. **Real durability on Render still needs a persistent disk or a database, which is your decision.** | Unit tests, including a restart over the same file. |
| F5 | Fixed | Malformed input and inconclusive checks come back as answers but cancel the payment. | Live: both returned, no money moved, ledger closed as failed. |
| F6 | Fixed | The payer is built for the endpoint the verified card vouches for, never a separately configured URL. | Unit tests. |
| F7 | Fixed, with a limit | The buyer recomputes the evidence hash from its own proof and the reported checks, and refuses a verdict that does not match. This proves consistency, not truth: verdicts are still unsigned. | Unit tests, including a verdict from the real validator and four tamperings. |

Not touched: F4 (the stubbed checks), F8 to F15.

New observations from the rerun:
- The sponsor's fee is not constant: 4,991,315 microCCD on 2026-11-07, 4,453,360 on 2026-11-11. Price and caps must track the chain's fee rate, not a one-off measurement.
- Concordium's hosted registry can answer `REGISTRY_UNAVAILABLE` under load. The buyer fails closed (no payment), now after two short retries.
