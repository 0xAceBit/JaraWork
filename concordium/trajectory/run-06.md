# Run 06: registration, badge, re-pin, keep-alive

Date: 2026-11-05. Network: Concordium testnet only.

## Did / verified

| Step | Result |
| --- | --- |
| Register (04 --submit) | Finalized `update`. Tx `2b829c80ed1a1bce963fd31772671f62f7adb362f6759ea7aec5376f3486c336`, cost 22196674 microCCD. Token id 1008, address `JyP9YR6Wk3YPaGx3e8zyu`. |
| agentWallet after registration | Defaulted to the owner account `47rTdQXd...VV3pk` (matches the earlier tests). |
| Badge (06) | Both routes agree. Card now 2462 bytes, sha256 `37108d208a53d554f27cc9b198564eb6baafc7b1fb035d293ae3ae2a03c669f6`. |
| Re-pin (07 + 04 --submit) | Signed by the owner. Dry run: success, 1532 energy. |
| Final check (05) | `badge_valid: true`, `issues: []`, 15 of 15 checks true. |

## Differences from the docs, and surprises

1. First signing attempt failed with "Verification failed": the key pasted was the PAYER's. Fixed with a public-key comparison (keycheck.ts) that now runs before any submit.
2. `verify_agent_card` returned `match: null` and `check_badge` said "error sending request" when Render was asleep. After waking the service it returned `match: true`. Null means "could not fetch", not "mismatch". Step 5's message was corrected.
3. The registry hashes the DECODED body, so Render/Cloudflare Brotli compression is harmless (answers the open question from run-04).
4. `build_agent_badge` also adds an ERC-8004-style `registrations` entry (not mentioned in the badge page).
5. The tool's next_steps mention a "sponsor service" making the re-pin gasless. NOT used or verified here: the owner paid the fee.
6. `04` prints "result: success" for a dry run, which was easy to mistake for a submitted transaction. The dry-run ending line now needs to be read: "Nothing was signed or sent".

## Assumed / still open

- Render free tier: 750 instance hours per workspace per month, shared by ALL free web services. A service kept awake 24/7 uses about 720 to 744 of them.
- UptimeRobot free plan: 50 monitors, 5 minute interval (from its pricing page, 2026-11-05).
- Whether the hackathon judges check the badge on testnet, and when. Unknown.
- The card still lacks `services` and `x402Support` until the MCP endpoint exists.
