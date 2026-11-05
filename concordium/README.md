# JaraWork x Concordium (hackathon module)

Isolated module on the `concordium-hackathon` branch. It is not part of the live JaraWork build and must not be merged to `main` until it has been tested.

Built with [Arc Studio](https://studio.arc.io)

## Isolation rules

- Own `package.json` and lockfile. Never add Concordium dependencies to the root `package.json`.
- Nothing in `src/`, `server/`, `contracts/` or the root `Dockerfile` is changed on this branch.
- Separate env vars and keys from the live app. Never reuse `CIRCLE_MAINNET_*` credentials here.
- Deploy as its own service, not the live one.

## Day-one compatibility results (@concordium/web-sdk 12.0.2)

Run with `bun run smoke:bun` or `node smoke/run.ts` from this folder. Read-only, no keys.

| Check | Node 24 | Bun 1.3.14 | Bun 1.4.4 |
| --- | --- | --- | --- |
| Import SDK main entry | pass | fail | fail |
| WASM token helpers | pass | fail | fail |
| gRPC-web client, testnet | pass | fail | fail |
| gRPC node client (grpc-js), testnet | pass | fail | fail |
| Hosted registry via plain fetch | pass | pass | pass |

Bun fails at module load with `Exported binding name 'Serializable' is not found` (and `'Header'` for the node client). The SDK works on Node.

## Decision

- Run SDK code (signing, x402 client, transaction submission) in a Node service.
- The Bun escrow agent talks to the registry with plain `fetch` against the hosted REST/MCP service, with no SDK.
- Do not import `@concordium/web-sdk` from any Bun process.
