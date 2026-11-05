# Run 04: registry registration scripts (testnet)

Date: 2026-11-05. Branch: `concordium-hackathon`. No keys were read, printed or stored.
Full request and response transcript: `trajectory/registry/transcript.jsonl`.

## Did

- Wrote seven rerunnable Node scripts in `scripts/registry/` (`lib.ts` plus steps 01 to 07).
- Step 1 `build_agent_card`: saved the returned card to `public/agent-card.json` as exact UTF-8 bytes (2298 bytes, no trailing newline).
- Added a route that serves that file's raw bytes at `/.well-known/agent-card.json` (`server.mjs`).
- Step 2: hashed the bytes the public Render URL serves. They match: `4867a13f...6397`.
- Step 3 `build_register`: built the payload for contract `<12802,0>`, entrypoint `CIS-8004.register`.
- Step 4 dry run: the node accepted the call as the owner account (`invokeContract`, no signature). Energy used 2081.
- Wrote steps 5 to 7 (verify, add badge, re-pin the hash) against the real response shapes.

## Verified

- Hash of the returned card equals SHA-256 of its UTF-8 bytes.
- The live Render URL serves bytes whose hash equals that value.
- The registration payload embeds the same hash bytes (`48 67 a1 3f ...`).
- The registration call succeeds in simulation on testnet.
- Typecheck and type-aware lint are clean for all scripts.

## Differences from the docs (flagged)

1. `build_agent_card` returns the card as a JSON string field `agent_card_json`. The hash is over that string's UTF-8 bytes. The docs only say "serve exactly the bytes".
2. The generated card is missing fields the docs' example card has: `type`, `image`, `supportedInterfaces`, `services`, `x402Support`, `active`, `registrations`. It has `url` and `authentication` instead, which the example does not. As built it is not yet a valid ERC-8004 registration file.
3. Two documented ways to add the badge: the tool's own note says to call `build_agent_card` again with the token id, while the badge page says use `get_badge_json` or `build_agent_badge`. Step 6 runs both routes and compares them.
4. Render's edge compresses the response with Brotli (919 bytes on the wire, 2298 decoded). The decoded hash matches. Whether the registry hashes decoded bytes is confirmed by `verify_agent_card` after registration.
5. You asked to sign with your wallet. No documented Node path signs through the wallet app. The signing step uses the key from the wallet's own export, held only in `concordium/.env`.

## Assumed

- The signing code (`--submit`) has not run with a real key. Everything before it has.
- The key exported from Wallet for Web ("Copy account private key") is the 64-hex-character ed25519 signing key the SDK signer expects.
- The indexer picks up the new agent within about 90 seconds (step 5 waits and retries).

## Not done yet

- The registration transaction. It needs your signature.
- Steps 5 to 7 against our own token.
- Adding `services` and `x402Support` to the card (waits for the MCP endpoint).
