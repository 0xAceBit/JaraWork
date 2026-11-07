# Run 09: the escrow decision ported to a Node buyer (prompt 7)

Date: 2026-11-07. Branch: concordium-hackathon. Nothing here touches the live app or any mainnet setting.

## Did
- src/buyer/registry.ts: the four registry calls (parse_token_address, agent_by_token_address, is_active, verify_agent_card).
- src/buyer/verifyValidator.ts: steps 1 to 5 plus 4b, each refusal with its own code and reason. The card is also hashed by the buyer itself, so the hosted service saying "true" is not enough. Payee comes from resolvePayee.
- src/buyer/decide.ts: pay only after verification, call validate_delivery_proof, branch on the verdict (RELEASE_NOW, FLAG_FOR_REVIEW, DEFER_TO_TIMER). A verdict about the wrong proof, the wrong order reference or with no evidence hash is not believed.
- src/buyer/orderStore.ts: stub store; it refuses to exist if live mainnet settings are in the environment.

## Verified
- 117 tests pass on Node 24 and Node 22.23.4; typecheck clean; lint 0 errors.
- One test per refusal (unknown badge, revoked agent, hash mismatch, endpoint mismatch, missing agentWallet) plus the happy path. A refused validator means the payer is never called (asserted).
- Live, against the real testnet registry (scripts/buyer-verify-live.ts, nothing paid): our validator passes steps 1 to 4 and is refused at 4b because its card does not yet list the MCP service. The wrong service URL, another agent whose card does not match, and a malformed badge are each refused with the right reason.

## Open
- The live happy path needs the Agent Card to list the MCP endpoint: add services and x402Support, re-host, re-pin (one signature).
- Paid mode is still off on Render, so a live paid release decision also waits on X402_ENABLED=true there.
- The card endpoint is read from an ERC-8004 style `services` entry named MCP. That is the format the docs describe; no source says the registry itself checks it.
