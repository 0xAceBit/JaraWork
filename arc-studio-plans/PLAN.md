# JaraWork — Order-to-Earner Marketplace Agent

## Summary
A decentralized gig marketplace that pulls orders from Jaramarket.store (and optionally Amazon, eBay, Jumia via user-provided API keys), broadcasts them as claimable tasks to registered workers/earners, and settles payment in USDC through an on-chain escrow — released only after the buyer confirms delivery.

## Architecture

- **Blockchain:** Arc Testnet — USDC is the native gas token, making escrow payouts predictable and cheap
- **Contract:** `JaraWorkEscrow.sol` — order creation, worker claiming, USDC escrow deposit, delivery confirmation, refund/dispute paths
- **Frontend:** React + Tailwind, four main views: Order Board, My Claims (worker), Create Order (buyer), API Key Settings
- **Wallet:** ConnectKit — workers and buyers connect their own wallets

## Contract: JaraWorkEscrow.sol

Key functions:
- `createOrder(orderId, description, usdcAmount)` — buyer deposits USDC into escrow
- `claimOrder(orderId)` — worker claims an open order (first-come, first-served)
- `submitDelivery(orderId, proofHash)` — worker marks done with proof hash
- `confirmDelivery(orderId)` — buyer releases escrow to worker
- `refundOrder(orderId)` — buyer refund on unclaimed order (timeout-protected)
- `disputeOrder(orderId)` — opens dispute for platform resolution

## Files to Create / Modify

1. `contracts/JaraWorkEscrow.sol` — escrow contract with order lifecycle state machine
2. `src/wagmi.ts` — wagmi + ConnectKit config for Arc Testnet
3. `src/App.tsx` — top-level shell: routing between views, wallet header
4. `src/components/OrderBoard.tsx` — live list of open orders workers can claim
5. `src/components/CreateOrder.tsx` — buyer form: description, USDC amount, source marketplace tag
6. `src/components/MyOrders.tsx` — worker's claimed orders, submit delivery, track status
7. `src/components/MarketplaceSettings.tsx` — per-user API key config (Jaramarket, Amazon, eBay, Jumia); keys in localStorage only
8. `src/hooks/useEscrow.ts` — wagmi hooks wrapping all contract reads/writes
9. `src/hooks/useMarketplaceOrders.ts` — polling hook fetching orders from configured marketplaces and pushing to contract
10. `src/lib/marketplaces/jaramarket.ts` — Jaramarket.store REST adapter
11. `src/lib/marketplaces/amazon.ts` — Amazon SP-API adapter
12. `src/lib/marketplaces/ebay.ts` — eBay Browse/Fulfillment API adapter
13. `src/lib/marketplaces/jumia.ts` — Jumia Seller API adapter
14. `src/lib/marketplaceRegistry.ts` — unified interface all adapters implement

## Build Sequence

1. Write and deploy `JaraWorkEscrow.sol` — escrow state machine, USDC transfer, events; security review before deploy
2. Wire wagmi config (`src/wagmi.ts`) — Arc Testnet chain, ConnectKit, USDC address from `onchain-facts`
3. Build `useEscrow.ts` hook — reads orders from contract events, wraps createOrder/claimOrder/submitDelivery/confirmDelivery
4. Build `OrderBoard.tsx` — open/claimed/completed orders from on-chain events; workers claim from here
5. Build `CreateOrder.tsx` — buyer deposits USDC and creates an order with marketplace source tag
6. Build `MyOrders.tsx` — worker dashboard: claimed orders, submit delivery with proof, track escrow state
7. Build marketplace adapters (Jaramarket first, then Amazon/eBay/Jumia stubs) and `useMarketplaceOrders.ts`
8. Build `MarketplaceSettings.tsx` — API key input per platform, stored in localStorage; test-connection button per integration
9. Wire `App.tsx` — tab navigation: Order Board / Create Order / My Orders / Settings

## Done When

- [ ] Worker connects wallet, sees open orders, and claims one
- [ ] Buyer connects wallet, deposits USDC into escrow via CreateOrder form
- [ ] Worker submits delivery; buyer confirms; USDC released to worker on Arc Testnet
- [ ] Buyer can refund an unclaimed order
- [ ] Jaramarket.store adapter polls for new orders using user's own API key
- [ ] Amazon, eBay, Jumia adapters accept user-supplied API keys and fetch live orders
- [ ] All API keys stored only in browser localStorage — never on-chain or on any server
- [ ] Settings page lets user add/remove keys and test each connection

## Marketplace API Key Notes

Each platform requires its own developer credentials:
- **Jaramarket** — REST or webhook endpoint on jaramarket.store
- **Amazon** — Amazon SP-API seller credentials (access key + secret)
- **eBay** — eBay Developer Program app credentials
- **Jumia** — Jumia Seller API key (availability varies by country)

Users paste their own keys in the Settings screen. All runs client-side in the browser.
