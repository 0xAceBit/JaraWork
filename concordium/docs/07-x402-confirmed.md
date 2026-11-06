# 07. x402: what the sources confirm

Status: research only, no payment code written. Date 2026-11-06.
Sources: docs.concordium.com x402 how-to page; @x402/concordium 2.30.0 and its spec in x402-foundation/x402 (commit b9cbd85); docs.x402.org.

## The two flows conflict

| | Concordium how-to page | Official package and spec |
| --- | --- | --- |
| Who submits the transaction | the client | the facilitator, after co-signing |
| What the client sends | a transaction hash | a partially signed sponsored transaction |
| Header | X-PAYMENT | PAYMENT-SIGNATURE (402 carries PAYMENT-REQUIRED) |
| Identity proof (ZKP) | checked by the facilitator | not mentioned |
| Who pays the fee | the client | the facilitator (sponsor) |

The brief for prompt 6 matches the left column. Only the right column has maintained code.

## Confirmed in the package source and spec

- Network id for testnet: `ccd:4221332d34e1694168c2a0c0b3fd0f27`.
- Asset is `"CCD"` (default) or a PLT token symbol. Amounts are atomic (microCCD) and must match exactly.
- The server copies the facilitator's `feePayer` into `requirements.extra.feePayer`.
- Nine facilitator checks: V1 format, sender, sponsor equals feePayer, recipient equals payTo, exact amount, asset type, expiry within maxTimeoutSeconds, sender signature checked against on-chain keys, one operation only.
- The facilitator adds its signature, submits, and waits for finalization (about 10 seconds). Settlement result: success, transaction hash, network, payer.
- If confirmation cannot be established, settle returns `settlement_pending` and the hash, and the caller must reconcile on chain.
- Client signing uses `buildBasicAccountSigner`; the facilitator reads `CCD_FACILITATOR_ADDRESS` and `CCD_FACILITATOR_PRIVATE_KEY`.
- The public x402.org facilitator does not list Concordium, so we must run our own.

## Not provided by the package, so we must build it

- Replay protection: no replay or duplicate handling anywhere in the Concordium code.
- One payment per request id: the `payment-identifier` extension exists but nothing enforces it.
- Spend caps, on either the buyer or the sponsor side.
- Fee accounting: `settle()` returns no cost, so sponsor versus buyer spend must be read from the chain.

## Spec and code disagree

Spec rule 9 says the sponsor must not be the recipient. The code rejects sponsor-as-sender but leaves sponsor-as-recipient unchecked, with a comment saying it is a legitimate flow (`scheme.ts`, lines 430 to 441).
