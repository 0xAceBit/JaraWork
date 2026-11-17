# Run 11: second hostile-judge review and its fixes (findings #1, #6, #3, #2)

Date: 2026-11-17. Branch: concordium-hackathon. The live JaraWork app and main were not touched.

## Did
- #1: `src/buyer/releasePolicy.ts`. Only a REAL carrier confirmation releases funds; a responding link or a retrievable file is availability, not delivery (opt-in only). Found and fixed a crash on a malformed checks list.
- #6: README, MCP tool description and open-world flag, code comment, docs 01/02/architecture/video script, service page; planning docs marked historical.
- #3: separate rate budgets (src/service/admission.ts), per-payer cap on uncharged answers (src/payments/freebies.ts), concurrency cap and a 12 s total budget for IPFS (src/service/realProbes.ts).
- #2: required buyer paid log and durable spend log (src/payments/spendLog.ts); a "durable" ledger claim is verified (device and filesystem type) and refused when false.
- Wrote docs/10-second-review.md: 14 findings, 3 fixed, 1 partly fixed, 10 open.

## Verified
- 273 tests pass on Node 24 and Node 22.23.4; typecheck clean; lint 0 errors.
- Live testnet end-to-end: 25 checks, 0 failures (trajectory/x402/e2e-2026-11-17T13-50-45-895Z.log), including the free-work cap (2 uncharged answers, the 3rd refused with TOO_MANY_UNCHARGED, no money moved).
- Public service, four-order judge demo (trajectory/judge-demo-2026-11-17.txt): the real link (order D) is paid for and NOT released (DEFER_TO_TIMER, AVAILABILITY_ONLY).
- No private key appears anywhere in the git history.

## Problems found while doing it
- A first version of the free-work check in the end-to-end test could not tell its own limit from the spend cap; it now records the server's refusal reason and runs while the cap has room.
- My first device-only durability check would have accepted a RAM disk; it now also checks the filesystem type.

## Not done
- A persistent disk for the server ledger (needs a paid instance; operator action).
- Findings #4, #5, #7 to #14 in docs/10.
