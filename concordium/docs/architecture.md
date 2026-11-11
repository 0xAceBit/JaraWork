# Architecture

## The pieces

```mermaid
flowchart LR
  subgraph arc["Arc: JaraWork escrow (unchanged, not connected yet)"]
    escrow["Escrow agent<br/>releases on a timer"]
  end

  subgraph buyer["Node buyer (this repo, src/buyer)"]
    verify["verifyValidator<br/>5 registry checks"] --> payer["x402 payer<br/>spend caps, payee check"] --> decide["release decision<br/>release / flag / defer"]
  end

  subgraph ccd["Concordium testnet"]
    registry["Agent Registry<br/>CIS-8004 token 1008"]
    chain["Sponsored CCD payment<br/>buyer pays price, sponsor pays fee"]
  end

  subgraph svc["Proof Validator service (Render, src/service)"]
    card["Agent Card<br/>hash pinned on chain"]
    tool["MCP tool<br/>validate_delivery_proof"]
    fac["Facilitator<br/>verifies and settles"]
  end

  verify --> registry
  verify --> card
  payer --> tool
  tool --> fac --> chain
  decide -. "stub order store only" .-> escrow
```

The dashed line is the honest gap: the decision logic exists and is tested, but it runs against a stub order store. Nothing here touches the JaraWork escrow or any mainnet.

## One decision, step by step

```mermaid
sequenceDiagram
  participant B as Buyer
  participant R as Concordium registry
  participant V as Validator service
  participant C as Concordium chain

  B->>R: badge exists, agent active, card hash equals chain
  B->>V: fetch the Agent Card and hash it
  B->>B: card lists the endpoint I am about to call
  B->>R: payee wallet (read from the registry, never from the card)
  B->>V: call validate_delivery_proof, no payment
  V-->>B: payment required: 7.5 CCD to the registry wallet
  B->>R: re-read the payee, check price cap and fee payer
  B->>V: same call with a signed payment
  V->>C: verify, run the checks, then settle (sponsor co-signs and pays the fee)
  V-->>B: verdict, reason, evidence hash
  B->>B: recompute the evidence hash from my own proof
  B->>B: decide: release now, flag for review, or defer to the timer
```

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Agent registration, badge, pinned card hash | Real, on Concordium testnet |
| Sponsored x402 payment, fee split from the chain | Real, on Concordium testnet |
| Payee read from the registry, hostile-buyer refusals | Real |
| Link check (guarded request, internal addresses refused) | Real network request |
| IPFS retrieval through public gateways | Real, but public gateways often rate-limit servers ("try later", not charged) |
| Carrier delivery status | Simulated stub, and every such verdict says so |
| Order store and the Arc escrow link | Stub; not connected |

## Safety properties that are tested

- A verdict can only be fetched again by the payer who paid, with a payment whose signature verifies, once.
- Malformed input and inconclusive checks are answered but not charged.
- A refused or unverifiable validator is never paid: the order falls back to the existing timer.
- The buyer never pays an address the server or the card names; it pays what the registry says.
- Server fetches refuse internal addresses, re-check every redirect, and connect only to the address they checked.
