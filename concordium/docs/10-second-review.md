# 10. Second review: hostile judge, after the first round of fixes

Date: 2026-11-17. Same brief as docs/09: integration depth and credible path to production, report first, fix after. Evidence labels: **CODE** read from the source, **LOG** shown in the logs, **RAN** executed in an earlier session, **UNVERIFIED** suspected.

## Findings and what happened to each

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | HIGH | A real link or IPFS pass released funds in production mode, and any live page passes | **Fixed.** Only a REAL carrier confirmation releases. See below. |
| 2 | HIGH | Replay, idempotency and cap state resets on restart; the buyer's cap and paid log reset too and were optional | **Partly fixed.** Buyer side fixed. Server side needs a persistent disk (your action). |
| 3 | HIGH | The free preview shared the global rate limit with the paid endpoint; free work for payers whose payments never settle | **Fixed**, with a known residual (the client key can be faked, so global limits are only a backstop). |
| 4 | MED-HIGH | The same proof can back many orders; the validator sees no order | Open |
| 5 | MED-HIGH | Sponsor hot key in the host's environment; the facilitator is self-run | Open |
| 6 | MED | README and tool text contradicted the code | **Fixed** (list below), except the Agent Card description, which needs a new on-chain signature to change |
| 7 | MED | Verdicts are unsigned; the evidence hash proves consistency only | Open |
| 8 | MED | "Chain wins" means the hosted indexer wins | Open |
| 9 | MED | The buyer-side card fetch has no internal-address guard or size cap | Open |
| 10 | MED | Concordium identity proofs and stablecoins unused | Open |
| 11 | LOW-MED | `setAgentWallet` documented but never run on chain | Open |
| 12 | LOW-MED | Fixed price while the sponsor fee moves (4.99, then 4.45, then 4.58 CCD) | Open |
| 13 | LOW | In-flight payments reserve sponsor budget; a revoked validator stays payable for up to 5 minutes | Open |
| 14 | LOW | Only the clean demo run was kept; `/x402/status` discloses totals | Open |

Of 14: 3 fixed, 1 partly fixed, 10 open.

## What was changed

**#1 Release policy** (`src/buyer/releasePolicy.ts`). The buyer decides from the names of the checks that passed, not from the validator's own labels. A real carrier confirmation may release. A simulated one releases in demo mode only. A link that responds, an IPFS file that can be retrieved, or a format-only pass proves existence, not delivery, so the order stays with the timer (`AVAILABILITY_ONLY`) unless the operator explicitly opts in. Consequence, stated plainly: carrier status is still a stub, so **outside demo mode nothing is released early today**. A malformed `checks` list that crashed the policy in a test was fixed.

**#3 Free work.** Three separate rate budgets (unpaid calls, payment-bearing calls, the free preview), so none can starve another. A verified payer that keeps asking for uncharged answers is refused for a while (proven live: two uncharged answers, the third refused with reason `TOO_MANY_UNCHARGED`, no money moved). Outbound checks are capped at 8 at a time, and one IPFS check can never take longer than 12 seconds in total.

**#2 Restart safety.** The buyer's paid log and daily spend log are now required arguments, and the spend cap is a durable rolling 24 hours. On the server, a "durable" claim is no longer taken on trust: it is refused if the ledger sits on the container's own filesystem, on a RAM disk, or cannot be inspected.

**#6 Text that disagreed with the code.** README (stale limits paragraph, a contradictory "simulated" line, outdated start command, a quick-start that omitted `npm install`, and an overclaim about "fixing the serious ones"); the MCP tool description and its open-world flag; a code comment; `docs/02` (unimplemented controls now marked as roadmap, outcomes updated); the architecture page; the video script; the service page. The planning docs 04 and 05 are marked historical.
