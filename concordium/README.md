# JaraWork Proof Validator (Concordium hackathon module)

A validator service for JaraWork delivery proofs, built for the Concordium Trusted Agents hackathon. Testnet only.

Built with [Arc Studio](https://studio.arc.io)

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
