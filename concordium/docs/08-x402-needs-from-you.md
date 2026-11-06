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
