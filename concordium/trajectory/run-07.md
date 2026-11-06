# Run 07: the validator as an MCP service (prompt 5)

Date: 2026-11-06. Branch: concordium-hackathon. Testnet only. Nothing touches `main` or the live app.

## Did
- Confirmed the official MCP SDK from its docs and the package itself, then used it:
  - Package `@modelcontextprotocol/sdk` 1.32.2 (repo modelcontextprotocol/typescript-sdk, branch v1.x), `zod` 4.6.6, both pinned exactly.
  - API used: `McpServer`, `registerTool(name, { title, description, inputSchema, outputSchema, annotations }, handler)` returning `{ content, structuredContent }`, and `StreamableHTTPServerTransport` in stateless mode (`sessionIdGenerator: undefined`) with `enableJsonResponse`.
- `src/service/`: envelope parser (the repo's on-chain proof format), stubbed lookups behind interfaces, canonical evidence hash, the validator, the MCP server, and the Node HTTP handler.
- `server.mjs`: adds `POST /mcp`, exports `createAppServer()` for tests, still starts with `node server.mjs`. The card route is untouched.
- Tests: valid, invalid, tampered, malformed input, the official MCP client against the real server, and the card bytes.

## Verified
- 74 of 74 tests pass on Node 24.21.0 and on Node 22.23.4 (the version Render runs). Typecheck clean. Lint: 0 errors.
- The official MCP client lists the tool, calls it, and gets structured content that mirrors the text content.
- The card is served byte for byte and hashes to the value pinned on chain (`37108d20...`). With `LIVE_REGISTRY=1` a test also confirms the repo file hashes to what the chain has pinned for token 1008.

## Differences from the docs, or surprises
- The MCP SDK now has two supported lines. v2 (`@modelcontextprotocol/server`, stable since 2026-07-27) is on `main`; v1.x (`@modelcontextprotocol/sdk`) is still maintained. The x402 MCP package we need next (`@x402/mcp` 2.30.0) depends on v1, so this service uses v1 to avoid two SDK majors in one process. Moving to v2 later is possible but not free.
- The official v1 docs show Express. The transport also takes plain Node `IncomingMessage`/`ServerResponse` (confirmed in its type definitions), so no Express dependency was added.
- The transport requires the client to send `Accept: application/json, text/event-stream`.

## Assumed or not done
- All lookups are STUBS, labelled `simulated: true` in every response and in the tool description. Nothing here is real-world evidence of delivery.
- The evidence hash is not a signature. It proves the verdict matches the evidence, not who produced it. Signing results is not built.
- No payment wrapper yet: the tool is free and unauthenticated. x402 comes next.
- The Agent Card still has no `services` entry for `/mcp` and no `x402Support`, because changing it means a re-host and a re-pin. The card is unchanged on purpose.
- No origin or host checks beyond the body-size cap and POST-only. Acceptable for a public read-only tool; revisit before adding payment.
