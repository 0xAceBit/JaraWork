# 08. x402: what I need before writing any payment code

Nothing below is built. Each item has a recommendation, so a one-word answer is enough.

## Decisions

| # | Question | Recommendation |
| --- | --- | --- |
| A | Which flow? Client broadcasts and sends a tx hash (how-to page), or sponsored transaction and PAYMENT-SIGNATURE (official package). | Official package. The other needs an identity-proof check no code or doc describes. |
| B | Which surface carries the payment? MCP tool call (`_meta`, via @x402/mcp) or a plain HTTP 402 route. | MCP only. The card's service will be MCP. |
| C | Asset: native CCD or a PLT stablecoin. | CCD. Both accounts hold 20,000. PLT has no public testnet faucet. |
| D | Accounts: spec forbids sponsor as recipient, code allows it. | Strict spec: three accounts. Payer `3HKu4...`, payee `47rTd...`, plus a new sponsor account funded with CCD from `47rTd...`. |
| E | Keys on Render: the sponsor key must be a Render secret for the public demo. | Yes, for a separate testnet-only account. Never a live JaraWork key. |
| F | Request id for "one payment per request". | `payment-identifier` id = `pay_` + first 32 hex of sha256(orderRef + ":" + proofSha256). |
| G | Numbers (testnet CCD, proposals only). | Price 10,000 microCCD. Buyer cap 20,000 per payment and 1,000,000 per day. Sponsor budget 5,000,000 per day. Sponsor per-transaction limit set after I measure one real fee. |

## What I will do once A to G are answered

1. Install `@x402/concordium`, `@x402/core`, `@x402/mcp` at exact versions.
2. Run our own facilitator inside this service, with `/supported` announcing the sponsor.
3. Wrap `validate_delivery_proof` with the payment wrapper.
4. Add the ledger: one payment per request id, replay protection, buyer and sponsor caps, and a record of what each side paid, read from the chain.
5. End-to-end test with logs: 402, pay, settle, result, then replay and over-cap attempts refused.

## Questions only Concordium can answer (workshop)

1. Spec rule 9 says the sponsor must not be the recipient. The code allows it. Which is authoritative?
2. Is the how-to page flow (tx hash plus identity proof) retired?
3. In a sponsored transaction, does the block summary `cost` belong to the sponsor, and how should spend be reconciled?
4. Does a testnet sponsor account need anything beyond an ordinary funded account?
5. Is any public Concordium facilitator available on testnet?

## Not verified yet

- Whether the node gRPC client works from Render (we use the web client there today).
- The real sponsor fee for one transfer.
- Whether @x402/mcp accepts a Concordium scheme registration (its README only shows EVM).

## Decisions recorded 2026-11-06

- Accounts: payer 3HKu4eSXZBTeCmf6XV51EQ1HuBe3tDNDo1TbDcEBzPgYrRHg1V (sender), payee 47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk (the registry agentWallet), sponsor and facilitator 3EZWRpdzPzi8WfsGRsiupiQEGZ6DjouZsANczD1uKEpkFL7qwc (1,500 CCD on testnet). Three separate accounts, as the spec requires.
- Asset: native CCD. Surface: the MCP tool call.
- Flow: build the sponsored flow from the official package first. A second payment option, where the client broadcasts and sends the transaction hash, comes after the first settled sponsored payment. Both would be offered in the same 402 `accepts` list. The how-to page's identity proof is not built because no source specifies it.
- Request id (F): `pay_` plus the first 32 hex of sha256("<orderRef>:<proofSha256>"), or of the proof hash alone when there is no orderRef. Same id and same proof returns the stored result with no second charge. Same id and a different proof is rejected. Ids are kept for 24 hours.
- Numbers (G), set from a measured fee, not guessed: price = 1.5 x the measured sponsor fee for one transfer, buyer cap per payment = 2 x price, buyer cap per day = 20 x price, sponsor budget per day = 50 x the measured fee. Testnet fees are large in CCD terms (a contract call cost 22.2 CCD), so these must be measured on the first settled payment.
