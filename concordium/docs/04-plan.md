# 04. Day-by-day plan: Nov 6 to Dec 9

Written 2026-11-05. Assumptions to confirm: roughly 2 to 3 focused hours on build days, lighter weekends, and a Nov 22 checkpoint that expects a working testnet demo. I do not know the checkpoint requirements or the submission format. Confirm both on Nov 6.

"You" rows are actions only you can do (accounts, faucet, keys, organizer contact). Keys go into `.env` or Render env vars yourself, never into chat. Share public addresses only.

## Phase 1: working end to end by the checkpoint (Nov 6 to Nov 22)

| Date | Build | You | Exit test |
| --- | --- | --- | --- |
| Fri Nov 6 | Sign off the specs. No code | Create two new testnet accounts (payer, sponsor). Request faucet CCD for each (once per account). Send the public addresses. Send the workshop questions. Ask what the Nov 22 checkpoint and submission need | `account-info` shows CCD on payer and sponsor |
| Sat Nov 7 | Signing spike: registry payload, sign with the SDK, submit, get a token id. Move a few CCD from payer to the owner account | Put the owner testnet key in `.env` as `CCD_OWNER_PRIVATE_KEY` | `agent_of(token)` returns our agent |
| Sun Nov 8 | Validator v2: repo envelope, `text` kind, response schema, codes | none | Tests green on Node 22 and 24 |
| Mon Nov 9 | URL reachability with the SSRF guard and redirect re-checks | none | Fake-server tests incl. redirect to a private IP pass |
| Tue Nov 10 | IPFS retrievability, simulated carrier fixtures, required-checks logic, demo flag | none | One test per row of the spec tables |
| Wed Nov 11 | MCP server on Node (unpaid) plus health route, deployed to the existing Render service | none | An MCP client call to Render returns a result |
| Thu Nov 12 | Build the card, host it at `/.well-known/agent-card.json`, pin the hash | Decide the always-on hosting question (free tier sleeps) | `verify_agent_card` returns `match: true` |
| Fri Nov 13 | Embed the badge, re-pin | none | `check_badge` clean, empty issues |
| Sat Nov 14 | Buffer | none | none |
| Sun Nov 15 | Our own x402 facilitator, first sponsored CCD payment locally | Put the facilitator key in env | One settled testnet tx hash, sponsor fee recorded |
| Mon Nov 16 | Wrap the tool with the x402 MCP wrapper, `payTo` = registry wallet, set the price from the measured fee | none | Paid call returns result and settlement hash |
| Tue Nov 17 | Deploy the paid stack, call it over the internet. **Gate 1** | none | Tx visible on the testnet explorer |
| Wed Nov 18 | Buyer: five validator checks, payment guard, endpoint from the verified card | none | Unit tests for every refusal row |
| Thu Nov 19 | Decision flow, stub store, the 12 scenarios, mainnet-refusal test | none | Scenario table all green |
| Fri Nov 20 | Demo runner, README draft with plain limits, run logs. **Gate 2** | none | Full demo from a clean clone |
| Sat Nov 21 | Rehearsal on the deployed stack, fix what breaks | Watch one cold run | No manual steps needed |
| Sun Nov 22 | **Checkpoint** | Submit as the organizers require | n/a |

Gate 1 (Nov 17): registered agent, pinned card, and one settled paid call. If it is not met, the first tier of the cut list applies immediately.
Gate 2 (Nov 20): the whole demo runs from a clean clone with no manual steps.

## Phase 2: hardening and submission (Nov 23 to Dec 9)

| Date | Work |
| --- | --- |
| Mon Nov 23 | Triage checkpoint feedback, re-plan |
| Tue Nov 24 | Failure modes: retries, idempotency, caching, every fall-to-timer path, chaos tests |
| Wed Nov 25 | Payment guard edge cases: wrong network, fee payer, amount, asset |
| Thu Nov 26 | Validator security pass: SSRF review, output hygiene, caps, rate limits, envelope fuzzing |
| Fri Nov 27 | Logs and audit trail (`proofSha256`, tx hash, outcome) |
| Sat Nov 28 | Buffer |
| Sun Nov 29 | Buffer, or stretch items only if every gate is green |
| Mon Nov 30 | Path-to-production document: Phases A, B and C, the agent patch proposal, false-positive plan, unit economics |
| Tue Dec 1 | Architecture diagram and final README, including "escrow stays on Arc; identity and payments run on Concordium" |
| Wed Dec 2 | Demo script and first recording |
| Thu Dec 3 | Reproducibility: fresh checkout, fresh accounts, full run, complete trajectory logs |
| Fri Dec 4 | **Feature freeze**, tag the release |
| Sat Dec 5 | Bug fixes only, final deploy, always-on check |
| Sun Dec 6 | Submission materials: links, video, form |
| Mon Dec 7 | Buffer, re-record if needed |
| Tue Dec 8 | **Submit**, one day early |
| Wed Dec 9 | Deadline. Emergency use only |

Buffer days: Nov 14, Nov 28, Nov 29, Dec 5, Dec 7, Dec 9.

## Things that can break the schedule outright

- No testnet CCD. Your wallet `47rT…` has 0 CCD and a transaction count of 1, so its one-time faucet request may already be spent. Use fresh accounts for the faucet and send CCD from them to the owner.
- Registration signing not working by Nov 8. Fallback is the registry web app with a browser wallet, if it supports testnet (unverified, ask the workshop).
- No stablecoin on testnet. Default plan is native CCD, so this does not block us.
- Render free tier sleeping while the card or MCP endpoint is checked. Decide on Nov 12.
