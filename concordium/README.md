# JaraWork Proof Validator (Concordium testnet)

An agent that checks the delivery proof a worker submits for an escrow order and answers pass or fail, with a short reason and a hash of the evidence it examined. It is paid per call over x402 in testnet CCD. It is registered in Concordium's Agent Registry with a valid badge, and a Node "buyer" verifies it from the registry before paying it. It is a module for the Concordium Trusted Agents hackathon, it runs on testnet only, and it is **not connected** to the JaraWork escrow on Arc.

Built with [Arc Studio](https://studio.arc.io)

Every statement here points at the file that implements it, a test, or a recorded log. A statement without one is not made. `npm test` fails if this README names a file, route, tool or setting that does not exist ([test/docs.test.ts](test/docs.test.ts)).

## Try it in 3 minutes, no account needed

The timed script with expected output is [docs/demo-video-script.md](docs/demo-video-script.md). The commands, run from this folder after `npm install`:

```
curl -s https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9YR6Wk3YPaGx3e8zyu   # Concordium's own check: badge_valid true
node scripts/judge-demo.ts                                                                  # buyer verifies the validator from the registry, pays nothing
node scripts/verify-evidence.ts                                                             # asks the chain about every transaction cited in this repo
```

The service page, with a free format-only preview, is https://jarawork-agent.onrender.com. To run the paid flow yourself, see "Run it on Node".

## What it does

The tool is `validate_delivery_proof` ([src/service/mcp.ts](src/service/mcp.ts)). Its input is the proof string stored on the order: a JSON object with a `type` of `tracking`, `url`, `ipfs` or `text` ([src/service/envelope.ts](src/service/envelope.ts)). The logic is in [src/service/validate.ts](src/service/validate.ts).

| Proof | What is checked | Real or simulated | Code |
| --- | --- | --- | --- |
| tracking | Format rules: postal (UPU S10) numbers with their check digit, UPS-style numbers, common digit-only lengths. Then the carrier's delivery status. | Format is real. **Carrier status is simulated** from fixed fixtures. | [src/validator/tracking.ts](src/validator/tracking.ts), [src/service/probes.ts](src/service/probes.ts) |
| url | https only, port 443, public host names. Then a guarded request confirms the address responds. | Real. A pass means the address responds, nothing more. | [src/validator/url.ts](src/validator/url.ts), [src/service/realProbes.ts](src/service/realProbes.ts) |
| ipfs | Content identifier structure (v0 and v1). Then retrieval through public gateways. | Real, but public gateways often answer 429, which is reported as unavailable. | [src/validator/ipfs.ts](src/validator/ipfs.ts), [src/service/realProbes.ts](src/service/realProbes.ts) |
| text | Never passes. | Real. | [src/service/validate.ts](src/service/validate.ts) |

The answer has `verdict` (pass or fail), `code`, `reason` (at most 200 characters, from fixed templates, never the raw proof), `retryable`, `simulated`, `checks`, `evidenceHash` (a SHA-256 over the evidence examined, see [src/service/evidence.ts](src/service/evidence.ts)), `proofSha256` and `orderRef` ([src/service/types.ts](src/service/types.ts)). The evidence hash shows a verdict is consistent with its evidence. It is not a signature.

**Payment.** The price defaults to 7,500,000 microCCD, which is 1.5 times the estimated sponsor fee ([src/payments/config.ts](src/payments/config.ts)). A caller is charged only for an answer: malformed input and inconclusive (retryable) results come back marked as errors, which cancels the payment ([src/payments/chargeability.ts](src/payments/chargeability.ts), [src/payments/paymentContext.ts](src/payments/paymentContext.ts)).

**The buyer** ([src/buyer/](src/buyer/)) acts for an escrow. Before it pays anything it runs [src/buyer/verifyValidator.ts](src/buyer/verifyValidator.ts): the badge parses, the agent exists in the trusted registry, it is active, its card hashes to the on-chain hash (the registry's check and the buyer's own fetch), the card lists the MCP endpoint being called, and the registry has a payee wallet. The payment policy ([src/payments/buyer.ts](src/payments/buyer.ts)) then pays only the wallet the registry returns, on the expected network, in CCD, within its caps. The verdict is accepted only if its proof hash, order reference and recomputed evidence hash match ([src/buyer/decide.ts](src/buyer/decide.ts)).

**The release decision** is `RELEASE_NOW`, `FLAG_FOR_REVIEW` or `DEFER_TO_TIMER`. Only a real carrier confirmation releases funds. A simulated confirmation releases only in demo mode. A link that responds or a file that exists defers, because that shows availability, not delivery ([src/buyer/releasePolicy.ts](src/buyer/releasePolicy.ts)). Today carrier status is simulated, so **nothing releases early outside demo mode**.

## How each Concordium component is used

| Component | What it is used for here | Code | Proof |
| --- | --- | --- | --- |
| Agent Registry (CIS-8004 contract on testnet, index 12802, subindex 0) | The validator is registered as token 1008 (address `JyP9YR6Wk3YPaGx3e8zyu`). The buyer trusts only this contract. | Contract id: `TESTNET_REGISTRY` in [src/registry/types.ts](src/registry/types.ts). Registration and re-pin: [scripts/registry/03-build-register.ts](scripts/registry/03-build-register.ts), [scripts/registry/04-sign-submit.ts](scripts/registry/04-sign-submit.ts), [scripts/registry/07-build-set-agent-uri.ts](scripts/registry/07-build-set-agent-uri.ts) | [trajectory/evidence.json](trajectory/evidence.json), checked by `node scripts/verify-evidence.ts` |
| Agent Card and Verified badge | The card lists the MCP endpoint and `x402Support`, and carries the badge. It is served byte for byte and its SHA-256 is pinned on chain. | [public/agent-card.json](public/agent-card.json), the `/.well-known/agent-card.json` route in [server.mjs](server.mjs), built by [scripts/registry/01-build-card.ts](scripts/registry/01-build-card.ts), [scripts/registry/06-build-badge.ts](scripts/registry/06-build-badge.ts), [scripts/registry/10-update-card.ts](scripts/registry/10-update-card.ts) | The registry's own check above. A test pins the card hash ([test/service.mcp.test.ts](test/service.mcp.test.ts)). |
| Concordium's hosted registry service (MCP) | Every registry read, and the builders that produce unsigned registry transactions. Reads used at run time: `parse_token_address`, `agent_by_token_address`, `agent_of`, `is_active`, `verify_agent_card`, `get_agent_wallet`. | [src/registry/hostedReader.ts](src/registry/hostedReader.ts), [src/buyer/registry.ts](src/buyer/registry.ts), [scripts/registry/lib.ts](scripts/registry/lib.ts) | Every request and response of the registration is in [trajectory/registry/transcript.jsonl](trajectory/registry/transcript.jsonl). |
| `agentWallet` | The buyer pays the wallet the registry returns, never one the card or the server names. A cleared wallet is refused. | [src/registry/resolvePayee.ts](src/registry/resolvePayee.ts), [src/buyer/verifyValidator.ts](src/buyer/verifyValidator.ts) | [test/resolvePayee.test.ts](test/resolvePayee.test.ts). The script that *sets* a wallet ([scripts/registry/08-set-agent-wallet.ts](scripts/registry/08-set-agent-wallet.ts)) exists but **has never been run on chain**. |
| x402 `exact` scheme, native CCD (`@x402/concordium` 2.30.0, `@x402/mcp` 2.30.0) | The paywall on the tool, the buyer's payment, and a facilitator that runs inside the service. | [src/payments/paymentContext.ts](src/payments/paymentContext.ts), [src/payments/facilitator.ts](src/payments/facilitator.ts), [src/payments/buyer.ts](src/payments/buyer.ts) | [trajectory/x402/e2e-2026-11-17T13-50-45-895Z.log](trajectory/x402/e2e-2026-11-17T13-50-45-895Z.log) and [trajectory/judge-demo-2026-11-17.txt](trajectory/judge-demo-2026-11-17.txt) |
| Sponsored transactions | The buyer signs a transfer and a separate sponsor account co-signs and pays the network fee. The fee paid by the sponsor versus the buyer is read from the chain. | [src/payments/accounting.ts](src/payments/accounting.ts) | `node scripts/verify-evidence.ts` prints the sponsor's fee and the buyer's fee (0) for each payment. |
| Concordium SDK over gRPC (`@concordium/web-sdk` 12.0.2) | Latest block (`/chain`), balances and transaction summaries for the fee record, and signing in the registration scripts. | [server.mjs](server.mjs), [src/payments/accounting.ts](src/payments/accounting.ts), [scripts/registry/04-sign-submit.ts](scripts/registry/04-sign-submit.ts) | [scripts/latest-block.ts](scripts/latest-block.ts) |

**Not used.** No code in this repository uses Concordium's zero-knowledge identity proofs, its protocol-level stablecoins, or any reputation or validation registry. The only asset paid is native CCD. Nothing runs on mainnet.

**Where the fee numbers come from.** The sponsor's fee moves with the chain: it was 4,991,315 microCCD on 2026-11-07 and 4,579,729 on 2026-11-17 ([trajectory/x402/](trajectory/x402/) and [trajectory/evidence.json](trajectory/evidence.json)). The price and caps are fixed settings, so they need re-checking when it moves.

## Run it on Node

Needs Node 22.18 or newer (`engines` in [package.json](package.json)). TypeScript runs directly, so there is no build step.

```
cd concordium
npm install
npm test             # offline tests, no network and no keys needed
npm run typecheck
```

Start the service. With no settings it starts **closed**: it serves the card, `/health` and the page, but `/mcp` answers 503 and `/x402/status` says why ([src/payments/config.ts](src/payments/config.ts)).

```
X402_MODE=free npm start        # free: anyone gets verdicts without paying; for local testing
```

Paid mode needs the sponsor account's key and an explicit choice about the ledger:

```
CCD_FACILITATOR_ADDRESS=<sponsor address> \
CCD_FACILITATOR_PRIVATE_KEY=<64 hex characters> \
X402_ALLOW_EPHEMERAL_LEDGER=true \
npm start
```

Put keys in `concordium/.env` (read at start, ignored by git), never in a command line you keep. Use testnet-only accounts.

**Run the full flow yourself.** `node scripts/judge-demo.ts --pay` runs four demo orders against the public service. It needs your own testnet account: put `CCD_PAYER_ADDRESS` and `CCD_PAYER_PRIVATE_KEY` in `concordium/.env` and get test CCD from the Concordium testnet faucet. It checks the key belongs to the address before paying anything. [scripts/x402-e2e.ts](scripts/x402-e2e.ts) runs the service in-process against testnet and makes two real payments of test CCD.

### Routes

| Route | What it does | Code |
| --- | --- | --- |
| `/` | Service page; JSON description for API clients | [server.mjs](server.mjs), [public/index.html](public/index.html) |
| `/mcp` | The MCP endpoint with `validate_delivery_proof` | [src/service/mcpHttp.ts](src/service/mcpHttp.ts) |
| `/demo/preview` | Free, offline format preview; never returns the paid verdict | [src/service/preview.ts](src/service/preview.ts) |
| `/x402/status` | Mode, price, payee, sponsor, whether the ledger is durable | [server.mjs](server.mjs) |
| `/.well-known/agent-card.json` | The Agent Card, exact bytes | [server.mjs](server.mjs) |
| `/og-image.svg` | Share-preview image | [server.mjs](server.mjs) |
| `/health` | Liveness | [server.mjs](server.mjs) |
| `/chain` | Latest Concordium testnet block, read live | [server.mjs](server.mjs) |

### Settings

Service ([server.mjs](server.mjs), [src/payments/config.ts](src/payments/config.ts)):

| Setting | Meaning (default) |
| --- | --- |
| `X402_MODE` | `free` serves verdicts without payment. Anything else, including unset, is paid and fails closed. |
| `CCD_FACILITATOR_ADDRESS` | Public address of the sponsor account (the demo sponsor). |
| `CCD_FACILITATOR_PRIVATE_KEY` | Sponsor signing key. `CCD_SPONSOR_PRIVATE_KEY` is read as a fallback. |
| `X402_ALLOW_EPHEMERAL_LEDGER` | `true` accepts that a restart erases the payment memory. |
| `X402_LEDGER_DURABLE` | `true` declares the ledger is on a persistent disk. The server checks this and refuses if the file is on the container's own filesystem or a RAM disk. |
| `X402_LEDGER_FILE` | Ledger path (`.data/payments.jsonl`). |
| `REGISTRY_TOKEN_ADDRESS` | Badge whose registry wallet gets paid (token 1008). |
| `PRICE_MICRO_CCD` | Price per call (7500000). |
| `ESTIMATED_SPONSOR_FEE_MICRO` | Fee estimate used for the budget (5000000). |
| `PAYER_DAILY_MAX_MICRO` | Per payer, per 24 hours (150000000). |
| `SPONSOR_DAILY_BUDGET_MICRO` | Estimated fees per 24 hours (250000000). |
| `X402_MAX_TIMEOUT_SECONDS` | How long a signed payment stays valid (60). |
| `X402_MAX_UNCHARGED_PER_MIN` | Uncharged answers one payer may get per minute (5). |
| `CCD_GRPC_HOST`, `CCD_GRPC_PORT` | Concordium node (`grpc.testnet.concordium.com`, 20000). |
| `LIVE_LINK_CHECKS` | `false` swaps the real link and IPFS checks for stubs. |
| `IPFS_GATEWAYS` | Comma-separated https gateways (`ipfs.io`, `dweb.link`, `w3s.link`). |
| `RATE_LIMIT_PER_MIN`, `RATE_LIMIT_GLOBAL_PER_MIN` | Unpaid `/mcp` calls, per client and overall (60, 3000). |
| `PAID_RATE_LIMIT_PER_MIN`, `PAID_RATE_LIMIT_GLOBAL_PER_MIN` | Payment-bearing calls (30, 240). |
| `PREVIEW_RATE_LIMIT_PER_MIN`, `PREVIEW_RATE_LIMIT_GLOBAL_PER_MIN` | The free preview, with its own budget (30, 300). |
| `PORT` | Listen port (3002). `CONCORDIUM_PORT` is read as a fallback. |
| `CCD_NETWORK` | A label shown in `/health`, `/chain` and the start-up line. It does **not** switch networks; the node address does. |

Scripts only:

| Setting | Used by |
| --- | --- |
| `VALIDATOR_BADGE`, `SERVICE_URL`, `ALLOWED_FEE_PAYER` | [scripts/judge-demo.ts](scripts/judge-demo.ts) (defaults: our badge, our service, our sponsor) |
| `CCD_PAYER_ADDRESS`, `CCD_PAYER_PRIVATE_KEY` | [scripts/judge-demo.ts](scripts/judge-demo.ts), [scripts/x402-e2e.ts](scripts/x402-e2e.ts) |
| `CCD_OWNER_ADDRESS`, `CCD_OWNER_PRIVATE_KEY`, `CCD_PAYEE_PRIVATE_KEY`, `PUBLIC_BASE_URL` | the registry scripts in [scripts/registry/](scripts/registry/) |

## Safety rules enforced in code

| Rule | Code | Test or log |
| --- | --- | --- |
| The buyer pays only the wallet the registry returns. A server asking for another address is refused before anything is signed. | [src/payments/buyer.ts](src/payments/buyer.ts), [src/registry/resolvePayee.ts](src/registry/resolvePayee.ts) | [test/resolvePayee.test.ts](test/resolvePayee.test.ts), the hostile-buyer checks in the end-to-end log |
| One payment per request, and a replayed payment is refused. | [src/payments/ledger.ts](src/payments/ledger.ts) | [test/payments.ledger.test.ts](test/payments.ledger.test.ts) |
| A stored verdict goes only to the original payer, after the payment's signature verifies, once. | [src/payments/cachedReplay.ts](src/payments/cachedReplay.ts) | [test/payments.cached.test.ts](test/payments.cached.test.ts) |
| No charge for malformed input or an inconclusive answer. | [src/payments/chargeability.ts](src/payments/chargeability.ts) | the "not charged" checks in the end-to-end log |
| Spend caps: the buyer's rolling 24 hours survive restarts; the server caps each payer and the sponsor's budget. | [src/payments/spendLog.ts](src/payments/spendLog.ts), [src/payments/ledger.ts](src/payments/ledger.ts) | [test/spendLog.test.ts](test/spendLog.test.ts), [test/payments.ledger.test.ts](test/payments.ledger.test.ts) |
| A payer that keeps getting uncharged answers is refused. | [src/payments/freebies.ts](src/payments/freebies.ts) | [test/freebies.test.ts](test/freebies.test.ts), the end-to-end log |
| Separate rate budgets for unpaid calls, payment-bearing calls and the free preview. | [src/service/admission.ts](src/service/admission.ts) | [test/admission.test.ts](test/admission.test.ts) |
| Outbound checks reach only public addresses, connect to the address that was checked, re-check every redirect, stop after 5 seconds (links) or 12 seconds in total (IPFS), and run at most 8 at a time. | [src/service/realProbes.ts](src/service/realProbes.ts) | [test/realProbes.test.ts](test/realProbes.test.ts) |
| An unconfigured paid service is closed, and a "durable ledger" claim is checked. | [src/payments/config.ts](src/payments/config.ts) | [test/payments.config.test.ts](test/payments.config.test.ts) |
| The demo order store cannot be pointed at a real escrow: it refuses to start if any mainnet setting is present. | [src/buyer/orderStore.ts](src/buyer/orderStore.ts) | [test/buyer.decide.test.ts](test/buyer.decide.test.ts) |

## Path to production

This is what stands between the demo and a real deployment, most important first. Each item says what the code does today.

1. **Real delivery evidence.** Carrier status comes from fixed fixtures ([src/service/probes.ts](src/service/probes.ts)), so every tracking verdict says `simulated`. Needed: a carrier integration with real credentials in place of the stub. Until then the release policy never releases early outside demo mode ([src/buyer/releasePolicy.ts](src/buyer/releasePolicy.ts)).
2. **Durable payment memory.** The ledger is one local file read by one process ([src/payments/ledger.ts](src/payments/ledger.ts)). The public service reports `ledgerDurable: false` at `/x402/status`, so a restart resets replay protection and the payer caps. Needed: a persistent disk with `X402_LEDGER_DURABLE=true`, or a database; more than one instance is not supported.
3. **Key custody.** The sponsor key is an environment variable ([src/payments/config.ts](src/payments/config.ts)), and the agent owner is also the payee ([trajectory/evidence.json](trajectory/evidence.json)). Needed: a managed secrets store, separate owner, payee and sponsor keys, and rotation.
4. **Trust in verdicts.** A verdict is unsigned and the evidence hash only proves consistency ([src/buyer/decide.ts](src/buyer/decide.ts)). A validator can still be wrong or dishonest. Needed: signed verdicts and more than one independent validator.
5. **Registry trust.** Every registry read goes through Concordium's hosted service ([src/registry/hostedReader.ts](src/registry/hostedReader.ts)). Needed: read the registry contract through your own node.
6. **Proof reuse.** The validator never sees the order ([src/service/validate.ts](src/service/validate.ts)), so one valid proof could back many orders. Needed: bind a proof to an order and detect reuse.
7. **Disputes and reputation.** Nothing in this repository handles either. A flagged order only changes a stub store ([src/buyer/orderStore.ts](src/buyer/orderStore.ts)). Needed: a review and appeal flow, a refund rule, and a record of how often each validator is right.
8. **Mainnet.** Every constant is testnet: the registry contract in [src/registry/types.ts](src/registry/types.ts) and the network id used by [src/payments/config.ts](src/payments/config.ts). The price is a fixed amount of CCD while the sponsor's fee moves. Needed: mainnet ids and endpoints, pricing tied to a stable unit, and an independent security review before any real funds.
9. **Arc and Concordium reconciliation.** No code connects an Arc escrow order to a Concordium payment. Needed: a durable record linking the order, the verdict and the payment, a plan for holding CCD, and a rule for what happens when one side succeeds and the other fails.
10. **Request limits.** The per-client rate-limit key comes from a header a caller can fake ([src/service/rateLimit.ts](src/service/rateLimit.ts)); the overall limits are the backstop. Needed: protection at the network edge.

Finding-level detail, including what was fixed and what is still open, is in [docs/09-judge-review.md](docs/09-judge-review.md) and [docs/10-second-review.md](docs/10-second-review.md).

## Evidence

| What | Where | How to check it |
| --- | --- | --- |
| Registration, the latest card re-pin and four demo payments, each with its sender, recipient, amount and who paid the fee | [trajectory/evidence.json](trajectory/evidence.json) | `node scripts/verify-evidence.ts` asks the chain and compares |
| The badge is valid and the card hash equals the chain | The registry's own check | `curl -s https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9YR6Wk3YPaGx3e8zyu` |
| A recorded paid run of four orders, with the decisions and who paid what | [trajectory/judge-demo-2026-11-17.txt](trajectory/judge-demo-2026-11-17.txt) | Read it, or rerun with `--pay` |
| The end-to-end run against testnet, including the attacks it refuses | [trajectory/x402/e2e-2026-11-17T13-50-45-895Z.log](trajectory/x402/e2e-2026-11-17T13-50-45-895Z.log) | Rerun [scripts/x402-e2e.ts](scripts/x402-e2e.ts) |
| Every registry request and response from the registration | [trajectory/registry/transcript.jsonl](trajectory/registry/transcript.jsonl) | Read it |
| What was done in each working session, including the mistakes | [trajectory/](trajectory/) (`run-01.md` onward) | Read it |

The earlier end-to-end logs in [trajectory/x402/](trajectory/x402/) are kept on purpose: several of them contain failed runs and the bugs they exposed.

## Repository map

| Path | Contents |
| --- | --- |
| [server.mjs](server.mjs) | The HTTP service and its routes |
| [src/service/](src/service/) | The validator: tool, checks, evidence hash, link and IPFS probes, rate budgets |
| [src/validator/](src/validator/) | Format rules for tracking numbers, links and IPFS identifiers |
| [src/payments/](src/payments/) | x402 paywall, facilitator, ledger, fee accounting, the buyer's payment policy |
| [src/buyer/](src/buyer/) | Validator verification and the release decision |
| [src/registry/](src/registry/) | Registry reads and the payee lookup |
| [scripts/](scripts/) | Judge demo, evidence check, end-to-end run, and the registration steps in `scripts/registry/` |
| [test/](test/) | Offline tests |
| [public/](public/) | The service page, the Agent Card and the share image |
| [docs/](docs/) | [architecture.md](docs/architecture.md), [demo-video-script.md](docs/demo-video-script.md), [submission-checklist.md](docs/submission-checklist.md), the two reviews, and planning notes written before the work that may differ from what was built (`01` to `08`, [integration-map.md](docs/integration-map.md)) |
