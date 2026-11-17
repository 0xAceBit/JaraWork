# Architecture

Everything drawn here exists in the code. A dotted line marked "not connected" is a gap, not a feature. File paths are in the node labels. The README's "Safety rules enforced in code" table lists the tests.

## Components

```mermaid
flowchart LR
  subgraph orders["Orders (a stub, no escrow)"]
    store["Stub order store<br/>src/buyer/orderStore.ts"]
  end

  subgraph buyer["Node buyer"]
    decide["Release decision<br/>src/buyer/decide.ts<br/>src/buyer/releasePolicy.ts"]
    verify["verifyValidator<br/>src/buyer/verifyValidator.ts"]
    pay["Payment policy and caps<br/>src/payments/buyer.ts"]
  end

  subgraph service["Validator service (server.mjs)"]
    mcp["MCP tool validate_delivery_proof<br/>src/service/mcp.ts"]
    wrap["x402 paywall, ledger, replay and caps<br/>src/payments/paymentContext.ts"]
    checks["Checks<br/>src/service/validate.ts"]
    fac["Facilitator, in process<br/>src/payments/facilitator.ts"]
    card["Agent Card, exact bytes<br/>public/agent-card.json"]
  end

  subgraph ccd["Concordium testnet"]
    hosted["Hosted registry service (MCP)"]
    reg["Agent Registry, CIS-8004<br/>contract 12802,0"]
    chain["Sponsored CCD transfer"]
  end

  subgraph net["Public internet"]
    links["Links and IPFS gateways"]
  end

  store --> decide
  decide --> verify
  verify --> hosted
  hosted --> reg
  verify -. "fetch card, compare hash with the chain" .-> card
  decide --> pay
  pay -. "re-read payee wallet" .-> hosted
  pay --> mcp
  mcp --> wrap
  wrap --> checks
  checks --> links
  wrap --> fac
  fac --> chain
  decide -. "not connected: no Arc escrow" .-> arc["JaraWork escrow on Arc"]
```

What is simulated: the carrier delivery status inside `checks` (`src/service/probes.ts`). Everything else on the diagram is real code and ran against testnet.

## One decision, step by step

```mermaid
sequenceDiagram
  autonumber
  participant B as Buyer (Node)
  participant H as Hosted registry service
  participant S as Validator service
  participant F as Facilitator (inside S)
  participant C as Concordium testnet

  B->>H: parse the badge, look up the agent, is it active
  B->>S: fetch the Agent Card and hash it, compare with the chain
  B->>S: call the tool, no payment
  S-->>B: payment requirements (price, payee, fee payer)
  B->>H: read the payee wallet again
  B->>S: call the tool with a signed payment
  S->>F: verify the payment (signature, balance, expiry)
  S->>S: run the checks
  alt it is an answer
    S->>F: settle
    F->>C: sponsor co-signs, submits and pays the fee
    S-->>B: verdict and evidence hash
  else malformed input or inconclusive
    S-->>B: verdict marked as an error, payment cancelled, no charge
  end
  B->>B: recheck proof hash, order reference and evidence hash
  B->>B: release policy chooses release, flag or defer
```

## How a verdict becomes a decision

```mermaid
flowchart TD
  v["Verified verdict"] --> t{"Free text?"}
  t -- "yes" --> flag["FLAG_FOR_REVIEW"]
  t -- "no" --> p{"Did it pass?"}
  p -- "no, definite" --> flag
  p -- "no, retryable" --> defer1["DEFER_TO_TIMER"]
  p -- "yes" --> c{"Which evidence?"}
  c -- "real carrier confirmation" --> release["RELEASE_NOW"]
  c -- "simulated carrier confirmation" --> m{"Demo mode?"}
  m -- "yes" --> release
  m -- "no" --> defer2["DEFER_TO_TIMER"]
  c -- "a link responds or a file exists" --> defer3["DEFER_TO_TIMER, availability only"]
```

Today carrier status is simulated, so outside demo mode nothing reaches `RELEASE_NOW`. An unverifiable validator, a refused payment, a failed call or a verdict that does not match its proof also defer (`src/buyer/decide.ts`).

## Trust boundaries

| Boundary | What crosses it | Control |
| --- | --- | --- |
| Buyer to validator service | A signed payment and a proof | The payee comes from the registry, caps and a payment policy apply (`src/payments/buyer.ts`). |
| Validator service to the public internet | Requests to links and IPFS gateways named by a stranger | Public addresses only, a pinned connection, re-checked redirects (`src/service/realProbes.ts`). |
| Anyone to the service | Unpaid calls, payment-bearing calls, the free preview | Three separate rate budgets (`src/service/admission.ts`). |
| Service to Concordium | Reads, and a sponsored transfer | The sponsor key is an environment variable (`src/payments/config.ts`). |
| This module to the real escrow | Nothing | The stub store refuses to start near mainnet settings (`src/buyer/orderStore.ts`). |
