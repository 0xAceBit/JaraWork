# 3-minute demo

Every command and every expected output below comes from a real run on 2026-11-17. Nothing here needs a key, an account or any test CCD.

## Before recording

1. `cd concordium && npm install`, once.
2. Wake the free-tier host so nothing waits during the take: `curl -s https://jarawork-agent.onrender.com/health`
3. Terminal font large. Do not open `concordium/.env`, and do not show any private key.
4. Say only what the demo shows. Carrier delivery status is simulated, and the demo says so.

## Script

| Time | On screen | What you say |
| --- | --- | --- |
| 0:00 | The service page, https://jarawork-agent.onrender.com | "JaraWork releases a worker's payment after a timer without looking at the proof. This agent is a paid second opinion in front of that release. It runs on Concordium testnet." |
| 0:20 | In the page's free preview, click the sample "bad check digit" (it fills in `RR123456784US` and checks it), then the sample "valid UPS number". | "This preview is free and checks the format only. The bad check digit is caught. It never returns the paid verdict." |
| 0:50 | Terminal, command 1 below | "This is Concordium's own registry, not ours. The agent is registered, the badge is valid, and the card we serve hashes to what is on chain." |
| 1:20 | Terminal, command 2 below | "Before a buyer pays, it verifies the validator itself: registered, active, card hash equals the chain, the card lists this endpoint, and it reads the payee wallet from the registry." |
| 1:50 | Terminal, command 3 below | "Calling the tool without paying returns a price, not a verdict: 7.5 test CCD, to the registry's wallet, with a separate sponsor account paying the network fee." |
| 2:10 | Terminal, command 4 below | "This is a recorded paid run of four orders. A is released, B and C are flagged, and D is deferred. D's link really responded, but a page that exists is not proof of delivery, so the buyer will not release funds on it." |
| 2:40 | Terminal, command 5 below | "Every transaction we cite is checked against the chain: who sent it, who received it, and who paid the fee. The buyer paid no fee, the sponsor did." |
| 2:55 | The README's "Path to production" heading | "Today the carrier lookup is simulated, so nothing releases early outside demo mode. The path to production lists what is missing." |

## Commands

```
# 1. Concordium's registry check, independent of us
curl -s https://agent-registry-mcp.concordium.com/v1/badge-check/JyP9YR6Wk3YPaGx3e8zyu
```
Expected: `"badge_valid": true` and `"issues": []`. About 0.6 seconds.

```
# 2. Verify the validator from the registry, paying nothing
node scripts/judge-demo.ts
```
Expected:
```
STEP 1  Verify the validator from the registry (nothing is paid)
  VERIFIED  registered agent, active, card hash matches the chain
            endpoint the card vouches for: https://jarawork-agent.onrender.com/mcp
            payee read from the registry:  47rTdQXdTQkWiL4fbHqdkxdtdpmWVGRTy7kXxXgxNJuirVV3pk
```
About 2.4 seconds.

```
# 3. The paid tool, called without paying: it answers with the price
curl -s https://jarawork-agent.onrender.com/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"validate_delivery_proof","arguments":{"proof":"{\"type\":\"tracking\",\"value\":\"1Z999AA10123456784\",\"carrier\":\"UPS\"}"}}}'
```
Expected: an error result whose body asks for payment: scheme `exact`, network `ccd:4221332d34e1694168c2a0c0b3fd0f27`, asset `CCD`, amount `7500000`, `payTo` the registry wallet `47rTdQ...`, fee payer `3EZWRp...`. It is long raw JSON, so for the recording pipe it through a formatter or just point at those fields.

```
# 4. The recorded paid run: the decisions, then who paid what
sed -n '/^STEP 2/,/^STEP 3/p' trajectory/judge-demo-2026-11-17.txt | grep -E "Order|decision|reason"
sed -n '/^STEP 3/,$p' trajectory/judge-demo-2026-11-17.txt | head -5
```
Expected: orders A `RELEASE_NOW`, B `FLAG_FOR_REVIEW`, C `FLAG_FOR_REVIEW`, D `DEFER_TO_TIMER (AVAILABILITY_ONLY)`, then buyer paid 30.000000 CCD (the price, no fee), validator earned 30.000000 CCD, sponsor paid 18.318916 CCD (the network fees).

```
# 5. Check every cited transaction against the chain
node scripts/verify-evidence.ts
```
Expected: six `OK` lines, each showing the sender, the recipient, 7500000 microCCD for the four payments, and the sponsor's fee, then `All transactions match what the docs say.` About 1.2 seconds.

## If you have time

- `npm test` runs the offline tests in about 2 seconds and should end with no failures.
- To run the paid flow live instead of showing the recording, use `node scripts/judge-demo.ts --pay`. It needs your own testnet account (see the README) and takes about two minutes, which does not fit a three-minute take.

## Limits to state out loud

- Carrier delivery status is simulated. Every such verdict says so.
- A link that responds or an IPFS file that exists shows availability only.
- This module is not connected to the JaraWork escrow on Arc.
- The public service's payment memory resets when it restarts.
