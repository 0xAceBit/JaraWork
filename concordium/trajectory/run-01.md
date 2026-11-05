# Run 01: runtime decision, deploy-ready service, offline validator

Branch: `concordium-hackathon` (the brief named `concordium-trusted-agents`; kept the existing name because the Render service is wired to it).
Network: Concordium testnet only. No keys, no funds, no live-app env touched.

## Session A: runtime compatibility (decides the runtime)

Did: ran the same six-check smoke test (`smoke/run.ts`) for `@concordium/web-sdk` 12.0.2 on three runtimes.

| Check | Node 24 | Bun 1.3.14 | Bun 1.4.4 |
| --- | --- | --- | --- |
| Import SDK main entry | pass | fail | fail |
| WASM token helpers | pass | fail | fail |
| gRPC-web client, testnet | pass | fail | fail |
| gRPC node client, testnet | pass | fail | fail |
| Hosted registry via plain fetch | pass | pass | pass |

Verified: Bun fails at module load (`Exported binding name 'Serializable' is not found`). Node reads live testnet state.
Decision: all Concordium code runs on Node 22+ in `concordium/`. The service is deployed on Render as a Node service (v22.23.4 reported by `/health`).
Assumed: nothing.

## Session B: deploy-ready service

Did: pinned dependencies, Node engines field, `.node-version`, root route, clean SIGTERM, branch-only dev proxy and status badge.
Verified: `/`, `/health`, `/chain` (live testnet block) and a 404 on the public Render URL; the live app (`jarawork.online`) still returns 200.
Assumed: nothing.

## Session C: step 1, offline `validate_delivery_proof` core

Did: `src/validator/` for URL, IPFS CID (v0 and v1, sha2-256) and tracking-number proofs. Input is one free-form string; output is `{ pass, kind, reason, detail? }`.
Verified: 13 unit tests pass on Node 24 (`npm test` equivalent: `node --test test/validator.test.ts`). The two CIDs used in tests decode as valid structures.
Found and fixed during testing: a recognisable-but-wrong tracking number (for example a bad postal check digit) lost its specific reason; now it keeps it.

Assumed / limits (state these honestly in the submission):
- Tracking checks are format-only. Digit-only carrier lengths (10, 12, 15, 20, 22) are well-known conventions but are NOT confirmed against carrier documentation. A pass never means "delivered".
- UPS check digit is not verified, only the `1Z` + 16 character structure.
- URL and CID checks are offline: nothing is fetched, so a pass does not mean the content exists.
- UNVERIFIED: Concordium x402 package name and API, sponsored-fee client flow, exact `agentWallet` resolution call. Not started; will be read from Concordium docs or source before use.

Next: step 2, reachability (SSRF-safe URL fetch, IPFS gateway check), then step 3, the MCP tool wrapper.
