# Demo video script (about 4 minutes)

I cannot record the video for you, so this is the shot list, the words and the exact commands.

## Before you press record
- Wake the service: open https://jarawork-agent.onrender.com/health once (the free tier sleeps; first load takes about a minute).
- Use a throwaway testnet account that holds a little test CCD. Never show `concordium/.env` or any key on screen.
- Terminal font large, window about 100 columns wide. Close other tabs.
- Have these open in tabs: the service page, the registry check URL, the GitHub repo.

## Shots

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | JaraWork main site, then the service page | "JaraWork pays workers when an order is delivered. Today the payment releases on a timer and nobody reads the proof. This agent is a trusted second opinion in front of that release." |
| 0:25 | Service page, free preview: click "valid UPS number", then "bad check digit" | "Anyone can try the format rules here for free. It tells you what it did not check, so it cannot be mistaken for the real paid answer." |
| 0:50 | Registry check URL in the browser: `badge_valid: true` | "This is Concordium's own registry saying the agent is registered, active and verified, and that its card matches what is pinned on chain." |
| 1:10 | Terminal: `node scripts/judge-demo.ts` | "A buyer never takes the validator's word. It checks the registry, hashes the card itself, confirms the endpoint, and reads the payee from the registry, not from the card." Point at VERIFIED. |
| 1:40 | Terminal: `node scripts/judge-demo.ts --pay` (cut the waiting) | "Four delivered orders. For each one: verify, pay over x402, get a verdict, decide." Point at each decision and its reason. |
| 2:40 | The "Who paid what" block | "The buyer paid the price and no fee. The sponsor paid the network fee. These numbers come from the chain, not from us." |
| 3:00 | Terminal: `node --test $(grep -o 'test/[a-zA-Z.]*test.ts' package.json)` | "Over two hundred tests, including attacks: a forged payment, a replayed payment, a link that points at an internal address. All refused." |
| 3:25 | `docs/09-judge-review.md` | "We reviewed our own work like a judge, found 15 problems, and fixed the serious ones. The list is public." |
| 3:40 | `docs/architecture.md` diagram | "What is real and what is simulated is labelled. Carrier status is still a stub. The Arc escrow is not connected yet. That is the next step." |
| 3:55 | Repo link, service link | "Everything is testnet, open source, and verifiable." |

## Commands, in order
```
cd concordium
node scripts/judge-demo.ts
node scripts/judge-demo.ts --pay
node --test $(grep -o 'test/[a-zA-Z.]*test.ts' package.json)
```
`--pay` needs `CCD_PAYER_ADDRESS` and `CCD_PAYER_PRIVATE_KEY` in `concordium/.env` for a funded testnet account.
