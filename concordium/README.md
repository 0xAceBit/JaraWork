# JaraWork Proof Validator (Concordium hackathon module)

A validator service for JaraWork delivery proofs, built for the Concordium Trusted Agents hackathon. Testnet only.

Built with [Arc Studio](https://studio.arc.io)

## For judges: the 3-minute version

**What it is.** A registered, badge-verified Concordium agent that checks the proof a worker submits for a JaraWork escrow order (a tracking number, a link, an IPFS hash) and answers pass or fail with a reason and an evidence hash. It is paid per call over x402 with fees sponsored, and a Node buyer verifies the agent from the registry before it pays anything.

**Why it matters.** JaraWork today releases a worker's payment after a timer without reading the proof. This agent is a trusted second opinion in front of that release: release early, flag, or fall back to the timer. Its identity, price and payee are publicly verifiable on Concordium instead of taken on faith.

**Verify it yourself in three minutes (free, no account):**
1. Open Concordium's own check: https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9YR6Wk3YPaGx3e8zyu and look for `badge_valid: true`.
2. Open https://jarawork-agent.onrender.com and try the free format preview.
3. Run `node scripts/judge-demo.ts`: it verifies the validator from the registry (registered, active, card hash equals the chain, endpoint, payee). Add `--pay` with your own testnet account to run four orders end to end.

**What is real:** the registration and badge, the sponsored x402 payments with the fee split read from the chain, the payee taken from the registry, the buyer's refusals, and the link check (a guarded request). **What is simulated, and says so in every answer:** carrier delivery status. **What is not connected yet:** the Arc escrow (orders are a stub store). Details and diagrams: [docs/architecture.md](docs/architecture.md).

**Evidence:** registry token 1008 on testnet; registration `2b829c80…c336`; four paid verdicts in [trajectory/judge-demo-2026-11-11-run2.txt](trajectory/judge-demo-2026-11-11-run2.txt); a 22-check live end-to-end log in `trajectory/x402/`; 230+ tests; a public self-review that found 15 problems and fixed the serious ones: [docs/09-judge-review.md](docs/09-judge-review.md). Submission list: [docs/submission-checklist.md](docs/submission-checklist.md). Video script: [docs/demo-video-script.md](docs/demo-video-script.md).

**Path to production (not built, written down):** key custody in a managed secrets service with separate owner, payee and sponsor keys; validator reputation and signed verdicts; a dispute path; mainnet configuration; and reconciliation between the Arc escrow (USDC) and the Concordium payment (CCD). See the last section of the review.

This module lives on the `concordium-hackathon` branch and is not part of the live JaraWork app. Do not merge it to `main` until it has been tested.

## What it does

`validate_delivery_proof` takes the proof a worker submits and returns pass or fail with a reason. It understands three kinds of proof:

- **URLs:** well-formed `https` links on public domains. Local, internal and IP-address links are rejected.
- **IPFS content IDs:** CIDv0 and CIDv1 (sha2-256), bare, as `ipfs://`, or inside a gateway link.
- **Tracking numbers:** UPU postal numbers (check digit verified), UPS-style numbers, and common digit-only carrier formats.

Current limits: these are structure checks. They do not confirm that a link loads, that IPFS content exists, or that a parcel was delivered. Those checks are planned next.

## Tech stack

Node.js 22 or later, plain ES modules and TypeScript run directly by Node, `@concordium/web-sdk` for Concordium access.

## Development

Prerequisite: Node.js 22 or later.

```bash
cd concordium
npm install
npm start        # service on :3002, routes /health and /chain
npm test         # validator unit tests
npm run smoke    # Concordium SDK check against testnet (read only)
```

Environment variables (all optional, no secrets needed yet):

- `PORT` or `CONCORDIUM_PORT`: port to listen on (default 3002).
- `CCD_NETWORK`: label shown by the service (default `testnet`).
- `CCD_GRPC_HOST`, `CCD_GRPC_PORT`: Concordium node to read from (default `grpc.testnet.concordium.com`, `20000`).

## Dev preview in Arc Studio

The branch adds a dev-only proxy route `/ccd-svc` in `vite.config.ts` and a small status badge in the preview panel. Neither ships in a production build.

## Deploying as its own Render service

Keep this separate from the live JaraWork service.

| Setting | Value |
| --- | --- |
| Branch | `concordium-hackathon` (never `main`) |
| Root Directory | `concordium` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node server.mjs` |
| Health Check Path | `/health` |
| Environment | `NODE_VERSION=22` |

## Isolation rules

- Own `package.json` and lockfile. Do not add Concordium dependencies to the root `package.json`.
- Nothing in `src/`, `server/`, `contracts/` or the root `Dockerfile` carries Concordium logic.
- Separate env vars and keys from the live app. Never reuse the live Circle credentials.
- Session history and decisions are logged in `trajectory/`.

## Documents

- `docs/integration-map.md`: what Concordium's docs and live services confirm, what is unverified, and the riskiest assumptions.
- `docs/01-validator-spec.md`: `validate_delivery_proof` request, response, codes and checks.
- `docs/02-buyer-flow.md`: the buyer's decision flow before release, and the stub order store.
- `docs/03-bun-to-node-port.md`: what a port would take, and why we do not port.
- `docs/04-plan.md`: day-by-day plan to Nov 22 and Dec 9.
- `docs/05-cut-list-and-scope.md`: cut order and scope-creep challenges.
- `trajectory/`: a log of every working session.

## Registering the agent on testnet

Run from `concordium/`. All steps are rerunnable and print every request and response.

```bash
node scripts/registry/01-build-card.ts          # build the Agent Card, save exact bytes
# commit and push public/agent-card.json, then:
node scripts/registry/02-check-hosted.ts --wait # hash what the public URL really serves
node scripts/registry/03-build-register.ts      # sign-ready register payload
node scripts/registry/04-sign-submit.ts         # dry run: simulates on the node, sends nothing
node scripts/registry/04-sign-submit.ts --submit  # signs with CCD_OWNER_PRIVATE_KEY and submits
node scripts/registry/05-verify.ts              # agent_of, is_active, verify_agent_card, check_badge
node scripts/registry/06-build-badge.ts         # add the badge to the card
# commit and push, then 02-check-hosted.ts --wait, then:
node scripts/registry/07-build-set-agent-uri.ts # payload to pin the new hash
node scripts/registry/04-sign-submit.ts --payload .data/set-agent-uri-payload.json --submit
node scripts/registry/05-verify.ts
```

The signing key lives only in `concordium/.env` (git-ignored). See `.env.example`.

### Payee and agentWallet

```bash
node scripts/registry/09-resolve-payee.ts [TOKEN_ADDRESS] [--card-claim ACCOUNT]  # who may be paid, read from chain
node scripts/registry/08-set-agent-wallet.ts [--new-wallet ADDR] [--format raw|wallet]  # then 04-sign-submit.ts --payload .data/set-agent-wallet-payload.json
npm test                                         # offline tests; add LIVE_REGISTRY=1 for the live ones
```

## Keeping the free Render service awake

Render's free tier spins a service down after 15 minutes without traffic, and a cold start takes about a minute. The registry's card check does not wait that long. Use an external monitor (for example UptimeRobot, 5 minute interval) on `/health`.

Render gives each workspace 750 free instance hours per month, shared by all free web services. One service awake all month uses about 720 to 744 of them, so keeping two free services awake exhausts the budget and Render suspends all free services until the next month. Check Billing > Monthly Included Usage in the Render dashboard before enabling it, or move this service to a paid instance.

## The MCP tool

`POST /mcp` speaks MCP over Streamable HTTP (stateless, JSON responses) and exposes one tool, `validate_delivery_proof`. Send `Accept: application/json, text/event-stream`.

- Input: `proof` (the exact deliveryProof string, a JSON object with `type` of `tracking`, `url`, `ipfs` or `text`) and an optional `orderRef`.
- Output: `verdict` (`pass` or `fail`), `code`, `reason`, `retryable`, `checks`, `evidenceHash`, `proofSha256`, `simulated`.
- In this testnet build the carrier, link and IPFS lookups are simulated stubs, and every response says so.

Try it:

```bash
curl -s -X POST http://localhost:3002/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"validate_delivery_proof","arguments":{"proof":"{\"type\":\"tracking\",\"value\":\"1Z999AA10123456784\",\"carrier\":\"UPS\",\"note\":\"\"}"}}}'
```

## The buyer

`src/buyer/` is the Node port of the escrow decision. Before paying anything it verifies the validator from the registry (badge, active status, card hash, card endpoint, payee). Only then does it pay over x402, call the tool and decide: release now, flag for review, or fall back to the existing timer. `scripts/buyer-verify-live.ts` runs the verification against the real testnet registry without paying.

## Modes and environment variables (paid service)

The service is paid by default and fails closed. If it is not configured correctly, `/mcp` answers 503 and `/x402/status` says why; it never falls back to free.

- `X402_MODE`: unset or `paid` (default), or `free` to serve verdicts without payment on purpose.
- `CCD_FACILITATOR_PRIVATE_KEY` and `CCD_FACILITATOR_ADDRESS`: the sponsor account that pays fees. Secret; set on the host only.
- `X402_LEDGER_DURABLE=true` if the ledger file is on persistent storage, or `X402_ALLOW_EPHEMERAL_LEDGER=true` to accept that a restart resets payment memory.
- `X402_LEDGER_FILE` (default `.data/payments.jsonl`), `PRICE_MICRO_CCD`, `PAYER_DAILY_MAX_MICRO`, `SPONSOR_DAILY_BUDGET_MICRO`, `ESTIMATED_SPONSOR_FEE_MICRO`, `REGISTRY_TOKEN_ADDRESS`.

## Try it

- **Service:** https://jarawork-agent.onrender.com (a page with live status, the Agent Card and the testnet block).
- **Verify the validator yourself (free, no account):** `node scripts/judge-demo.ts` checks the agent in the Concordium registry: registered, active, card hash equal to the chain, endpoint, payee.
- **Run the whole flow (needs your own Concordium testnet account with test CCD):** put `CCD_PAYER_ADDRESS` and `CCD_PAYER_PRIVATE_KEY` in `concordium/.env`, then `node scripts/judge-demo.ts --pay`. It runs four stub orders: verify, pay over x402, get a verdict, decide. One of them uses the real link check. A recorded run is in `trajectory/judge-demo-2026-11-11-run2.txt`.
- **Call the tool directly from an MCP client:** connect to `https://jarawork-agent.onrender.com/mcp` and call `validate_delivery_proof`. The service is paid: an unpaid call returns the payment requirement (7.5 CCD, paid to the registry wallet, fees sponsored).

Honest limits:
- **Links are checked for real** (a guarded request: https only, internal addresses refused, redirects re-checked). A responding link does not prove it shows the delivery.
- **IPFS retrieval is real but unreliable from shared servers:** public gateways rate-limit them, so the answer is often "unavailable, try later" (not charged). Set `IPFS_GATEWAYS` to your own gateway for dependable results.
- **Carrier status is a simulated stub** and every such verdict says so.
- Orders are a stub store; nothing here touches the JaraWork escrow or any mainnet.

## More settings

- `LIVE_LINK_CHECKS=false` turns the real link and IPFS checks off (labelled stubs instead).
- `IPFS_GATEWAYS` comma-separated https gateways for IPFS retrieval.
- `RATE_LIMIT_PER_MIN` (default 60 per client) and `RATE_LIMIT_GLOBAL_PER_MIN` (default 600 in total) limit calls to `/mcp`.
