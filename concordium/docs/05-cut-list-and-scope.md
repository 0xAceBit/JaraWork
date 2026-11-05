# 05. Cut list and scope-creep challenges

Written 2026-11-05.

## Never cut (this is the product)

1. A registered testnet agent whose published card matches its pinned hash.
2. A real settled, sponsored payment for each paid call.
3. A buyer that verifies the validator (five checks) and pays the wallet the registry returns.
4. The decision flow against the stub store, all 12 scenarios.
5. An honest README: simulated carrier checks, text never releases, format-only limits, and that escrow stays on Arc while identity and payments run on Concordium.

## Cut order, first to go

Tier 1: cut when Gate 1 (Nov 17) is missed, or any build day slips by two days.

1. Any UI or status page. Terminal demo only.
2. Badge logo and visuals.
3. IPFS retrievability. Keep the format check and label the level.
4. Simulated carrier status. Tracking becomes format-only and can no longer release, so scenario 6 is dropped.
5. Result caching and metrics.
6. Video polish. Use a terminal recording.

Tier 2: cut when Gate 2 (Nov 20) is missed.

7. Retries with backoff. One attempt, then defer to the timer.
8. A distinct `agentWallet` (already off by default).
9. Redirect following for URLs. Reject any redirect.
10. Scenarios 9 to 12 become unit tests with test doubles.

Tier 3: emergency, last ten days.

11. Hosting that stays awake. Fall back to a recorded session plus the public repo. This is the weakest option.

Fallback that must stay honest: if no paid call can settle by Nov 20, ship the verified-validator, payment-guard and decision flow, show the payment step with a recorded real settlement if we have one, and say so. Never present a simulated settlement as real.

## Scope-creep challenges to the brief

| Item | Verdict | Reason |
| --- | --- | --- |
| Third-party validators competing in the same market | Slide only, zero code | We pin one validator. Discovery and ranking is a separate product |
| Porting the Bun escrow agent to Node | No | See doc 03. A 20-line optional flagged call is enough |
| Judging free-text proofs with an LLM | No | Text never passes. An LLM judge adds cost, injection risk and no verifiable evidence |
| Real carrier APIs (UPS, FedEx, DHL, local carriers) | No for the hackathon | Needs accounts and keys per carrier. Simulate, label it, put it on the roadmap |
| Stablecoin payments (USDR, EURR) | No unless issued to us | No public testnet faucet. Native CCD works with the same flow |
| ERC-8004 reputation and validation registries, CIS-8 key bindings | No | Not needed for registration, card, badge or payment |
| A2A endpoint and REST API alongside MCP | No | MCP only. The card is still published |
| Any new frontend | No | The live JaraWork UI stays untouched |
| Disputes, refunds, mainnet | No | The stub store has no money in it |
| Bridge between Arc and Concordium | No | They are separate on purpose. Say so |
| Pricing tiers, batching, subscriptions | No | One flat price per call |
| Claude Desktop connector demo | Stretch only, Nov 29 | Only if every gate is green |
| Sharing validator rules with the live frontend | Roadmap | Production item, not hackathon code |

## Where the brief is risky, not just large

1. **"The escrow agent is the buyer."** True in architecture, not in process. The Concordium SDK cannot load under Bun, so the buyer is a Node service acting for the agent. Say that plainly.
2. **"Paid with sponsored fees."** The sponsor pays the network fee in CCD for every call. The price must exceed that fee or each call loses money. One operator running both the validator and the facilitator is described as allowed in a Concordium commit message, but I could not find it stated in the docs. Treat as unverified.
3. **"Integration depth."** Depth is real registry verification, a real payment, and honest limits. Adding more protocols (A2A, REST, reputation) adds breadth, not depth, and takes days we do not have.
4. **Tracking numbers.** Without a real carrier lookup, a tracking pass proves only the number's shape. A judge may ask. The answer is the simulated label, and it must be visible in the output.
5. **Early release.** It shortens today's 24-hour dispute window. We document the caveat. We do not solve it in this hackathon.
