# 03. Bun escrow agent to Node: what changes, and the smallest port

Written 2026-11-05. Facts below were checked against `server/agent.ts` today. Nothing here changes the live app.

## Recommendation: do not port the agent

The smallest port is no port. The Concordium SDK fails to load under Bun (tested, see `trajectory/run-01.md`), so everything that touches Concordium lives in a separate Node service. The existing agent stays on its current runtime and only gains one optional, flagged HTTP call to that service. `fetch` is built in, so the agent needs no new dependency.

Porting the live agent for a hackathon would put a service that holds real USDC on Arc mainnet through a runtime change, on a deadline, with no product benefit. That is the clearest scope creep in the brief.

## What the agent needs for the proof gate (not applied, proposal only)

1. `readOrderFields()` returns `deliveryProof`. It already decodes it and drops it, so this is a one-line change.
2. A new env flag `PROOF_GATE_URL` plus `PROOF_GATE_MODE` with values `off` (default), `shadow`, `advisory`.
3. In `processAutoRelease()`, before the delay check: if the mode is not `off`, send the order key and proof to the gate service.
   - `shadow`: log the verdict, change nothing.
   - `advisory`: on `RELEASE_NOW`, call `confirmDelivery` early; on `FLAG_FOR_REVIEW`, log and notify; on `DEFER_TO_TIMER` or any error, fall through to the existing timer logic untouched.
4. A short timeout on the call and a catch-all, so a gate failure can never throw out of the loop.

Roughly 20 lines, all behind a default-off flag. This is not applied on `main` or on this branch. It is a documented patch for the production-path story.

## If a full Node port is ever needed

Verified facts:

| Item | Finding |
| --- | --- |
| Bun-specific API calls | 3 total: `Bun.file` at lines 63 and 69 (static files), `Bun.serve` at line 690 (HTTP server). None are in the release, refund or marketplace loops |
| CommonJS | One `require('../src/onchain-facts.ts')` at line 102. `require` is undefined in a Node ES module |
| `.env` loading | Bun loads `.env` automatically in local dev. Node needs `--env-file`. Render injects env vars, so production is unaffected |
| Syntax | `node --check server/agent.ts` exits 0 on Node 22.23.4. Root package is ESM. No enum, namespace or parameter-property syntax found |
| Imports | Adapters import only types with extensionless paths, which are erased. `registry.ts` has extensionless value imports, but the agent does not import it |
| Scripts | `agent` and `start` in `package.json` and the Dockerfile `CMD` use `bun run` |
| Not checked | Whether the Circle wallets SDK and `web-push` behave identically under Node. I believe they do. Unverified |

The port, in order:

1. Replace `Bun.file` with `node:fs` reads (two sites, mime map already exists).
2. Replace `Bun.serve` with `node:http` plus a small adapter from `IncomingMessage` to `Request` and from `Response` to `ServerResponse`, keeping the existing fetch-style handler. The file has many routes, so the adapter is what keeps the change small.
3. Replace the `require` with an `import`.
4. Switch scripts and the Dockerfile `CMD` to `node`, and start with `--env-file` locally.
5. Run it under Node with the contract address unset (the loops return early) to exercise every route. Never with the mainnet wallet in a sandbox.

Honest estimate: five edits, roughly 60 to 100 lines, plus a full route test pass. It has not been measured. Do not start it before the Dec 9 deadline.
